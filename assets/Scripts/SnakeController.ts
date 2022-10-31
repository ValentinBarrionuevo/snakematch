import {
  _decorator,
  Component,
  RigidBody2D,
  KeyCode,
  input,
  EventKeyboard,
  Input,
  find,
  Prefab,
  instantiate,
  Sprite,
  Vec3,
  SpriteFrame,
  Node,
  EventTouch,
  AudioSource,
  assert,
  Label,
} from "cc";
import { GameManager } from "./GameManager";
const { ccclass, property } = _decorator;

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

@ccclass("SnakeController")
export class SnakeController extends Component {
  public character: RigidBody2D = null;

  @property(SpriteFrame)
  private spriteArray: Array<SpriteFrame> = new Array<SpriteFrame>(4);

  @property(Prefab)
  private bodyPrefab: Prefab;

  private velocitySeconds: number = 0.4;
  public movementCount: number = 0;
  public matchCount: number = 0;

  private firstMove: boolean = true;
  private direction: Direction;
  private isGoingVertical: boolean;
  private blockMove: boolean = false;

  public snakeInside: Array<Node> = new Array();
  private snakePositions: Array<{ x: number; y: number }>;
  private headPos: Vec3;

  private tileSize = 30;

  private audioSource: AudioSource = null!;

  private keyWhiteList: Array<KeyCode> = new Array(
    KeyCode.KEY_W,
    KeyCode.ARROW_UP,
    KeyCode.KEY_S,
    KeyCode.ARROW_DOWN,
    KeyCode.KEY_A,
    KeyCode.ARROW_LEFT,
    KeyCode.KEY_D,
    KeyCode.ARROW_RIGHT
  );
  private _touchStartPos: import("cc").math.Vec2;

  public onLoad(): void {
    this.character = this.node.getComponent(RigidBody2D);

    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
    input.on(Input.EventType.TOUCH_END, this.touchEnd, this);

    const audioSource = this.getComponent(AudioSource)!;
    assert(audioSource);
    this.audioSource = audioSource;
  }

  public onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
    input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
    find("Canvas/UI/Death").active = true;
  }

  public touchStart(e: EventTouch): void {
    this._touchStartPos = e.getLocation();
  }

  public touchEnd(e: EventTouch): void {
    if (!this._touchStartPos) {
      return;
    }

    const start = this._touchStartPos;
    const end = e.getLocation();
    this._touchStartPos = null;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    this.isGoingVertical = Math.abs(dy) < Math.abs(dx);
    if (length < 60) {
      return;
    }
    if (this.isGoingVertical == false || this.isGoingVertical == undefined) {
      if (
        this.direction == "RIGHT" ||
        this.direction == "LEFT" ||
        this.direction == undefined
      ) {
        if (dy > 0) {
          this.direction = "UP";
        } else {
          this.direction = "DOWN";
        }
      }
    }
    if (this.isGoingVertical == true || this.isGoingVertical == undefined) {
      if (
        this.direction == "UP" ||
        this.direction == "DOWN" ||
        this.direction == undefined
      ) {
        if (dx > 0) {
          this.direction = "RIGHT";
        } else {
          this.direction = "LEFT";
        }
      }
    }
    if (this.firstMove == true) {
      this.firstMove = false;
      this.startTicker();
    }
  }

  private onKeyDown(event: EventKeyboard): void {
    if (this.isGoingVertical == false || this.isGoingVertical == undefined) {
      switch (event.keyCode) {
        case KeyCode.KEY_W:
        case KeyCode.ARROW_UP:
          this.direction = "UP";
          this.isGoingVertical = true;
          break;
        case KeyCode.KEY_S:
        case KeyCode.ARROW_DOWN:
          this.direction = "DOWN";
          this.isGoingVertical = true;
          break;
      }
    }
    if (this.isGoingVertical == true || this.isGoingVertical == undefined) {
      switch (event.keyCode) {
        case KeyCode.KEY_A:
        case KeyCode.ARROW_LEFT:
          this.direction = "LEFT";
          this.isGoingVertical = false;
          break;
        case KeyCode.KEY_D:
        case KeyCode.ARROW_RIGHT:
          this.direction = "RIGHT";
          this.isGoingVertical = false;
          break;
      }
    }

    if (this.firstMove == true && this.keyWhiteList.includes(event.keyCode)) {
      this.firstMove = false;
      this.startTicker();
    }
  }
  private startTicker(): void {
    this.schedule(() => {
      this.headMovement();
    }, this.velocitySeconds);
  }

  private headMovement(): void {
    const pos = this.node.getPosition().clone();
    this.headPos = pos.clone();

    switch (this.direction) {
      case "UP":
        pos.y += this.tileSize;
        this.node.angle = 0;
        break;
      case "DOWN":
        pos.y -= this.tileSize;
        this.node.angle = 180;
        break;
      case "LEFT":
        pos.x -= this.tileSize;
        this.node.angle = 90;
        break;
      case "RIGHT":
        pos.x += this.tileSize;
        this.node.angle = 270;
        break;
    }
    this.node.setPosition(pos);
    this.movementCount++;
    this.savePositions();
    this.bodyMovement();

    this.deathCheck(pos);

    find("Canvas").getComponent(GameManager).checkGameState();
  }

  private savePositions(): void {
    if (this.snakeInside.length < 1) {
      return;
    }

    this.snakePositions = [{ x: this.headPos.x, y: this.headPos.y }];
    for (let snakePart of this.snakeInside) {
      this.snakePositions.push({
        x: snakePart.getPosition().clone().x,
        y: snakePart.getPosition().clone().y,
      });
    }
  }

  private bodyMovement(adjust?: boolean): void {
    if (this.snakeInside.length < 1) {
      return;
    }
    if (!this.blockMove || adjust) {
      for (let i = 0; i < this.snakeInside.length; i++) {
        const newPos = this.snakePositions[i];
        this.snakeInside[i].setPosition(new Vec3(newPos.x, newPos.y, 0));
      }
    } else {
      this.snakeInside[0].active = true;
      this.blockMove = false;
    }
  }

  private deathCheck(pos: Vec3): void {
    if (pos.x > 150 || pos.x < -150) {
      this.node.destroy();
      return;
    }

    if (pos.y > 241 || pos.y < -241) {
      this.node.destroy();
      return;
    }
  }

  public eatBall(ball: number): void {
    //this.audioSource.play();

    const part = this.spawnBody(ball);

    if (this.snakeInside.length >= 3) {
      if (!this.matchCheck(part)) {
        this.blockMove = true;
      }
    } else {
      this.blockMove = true;
    }
  }

  private matchCheck(part: Node): boolean {
    const type1 = part.getComponent(Sprite).spriteFrame.name;
    const type2 = this.snakeInside[1].getComponent(Sprite).spriteFrame.name;
    const type3 = this.snakeInside[2].getComponent(Sprite).spriteFrame.name;

    const condition = type1 == type2 && type2 == type3;
    if (condition) {
      part.destroy();
      this.snakeInside[1].destroy();
      this.snakeInside[2].destroy();

      this.snakeInside.splice(0, 3);

      let gameManager = this.node.parent.parent.getComponent(GameManager);

      gameManager.multiplier += gameManager.multiplier;
      gameManager.points += 800 * gameManager.multiplier;
      find("Canvas/UI/Multiplier").getComponent(Label).string =
        "x" + gameManager.multiplier;

      this.matchCount++;

      for (let i = 0; i < this.snakeInside.length; i++) {
        const newPos = this.snakePositions[i];
        this.snakeInside[i].setPosition(new Vec3(newPos.x, newPos.y, 0));
      }
      this.savePositions();
    }
    return condition;
  }

  private spawnBody(color: number): Node {
    const snekPart: Node = instantiate(this.bodyPrefab);
    this.node.parent.addChild(snekPart);
    this.snakeInside.unshift(snekPart);

    snekPart.getComponent(Sprite).spriteFrame = this.spriteArray[color];
    let pos = this.node.getPosition().clone();
    pos = new Vec3(Math.round(pos.x), Math.round(pos.y), 0);
    snekPart.setPosition(pos);
    snekPart.active = false;
    return snekPart;
  }

  public eatBomb(): void {
    let lastAte = this.snakeInside[0];

    let filtered = this.snakeInside.filter((child) => {
      return (
        child.getComponent(Sprite).spriteFrame.name ==
        lastAte.getComponent(Sprite).spriteFrame.name
      );
    });

    for (let i = 0; i < filtered.length; i++) {
      const index = this.snakeInside.indexOf(filtered[i]);
      this.snakeInside[index].destroy();
      this.snakeInside.splice(index, 1);
    }

    for (let i = 0; i < this.snakeInside.length; i++) {
      const newPos = this.snakePositions[i];
      this.snakeInside[i].setPosition(new Vec3(newPos.x, newPos.y, 0));
    }
    this.savePositions();

    find("Canvas/UI/Points").getComponent(Label).string = (find(
      "Canvas"
    ).getComponent(GameManager).points +=
      filtered.length *
      300 *
      find("Canvas").getComponent(GameManager).multiplier).toString();
  }
}
