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
  bodyPrefab: Prefab;

  private firstMove: boolean = true;
  private velocitySeconds: number = 0.4;
  private direction: Direction;
  private isGoingVertical: boolean;

  private snakeInside: Array<Node> = new Array();

  private tileSize = 30;

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
    find("Canvas/button").active = false;

    this.character = this.node.getComponent(RigidBody2D);

    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
    input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
  }

  public onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
    input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
    find("Canvas/button").active = true;
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
      if (dy > 0) {
        this.direction = "UP";
      } else {
        this.direction = "DOWN";
      }
    }
    if (this.isGoingVertical == true || this.isGoingVertical == undefined) {
      if (dx > 0) {
        this.direction = "RIGHT";
      } else {
        this.direction = "LEFT";
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
      this.snakeMovement();
    }, this.velocitySeconds);
  }

  private snakeMovement(): void {
    const pos = this.node.getPosition();
    const oldPos = { x: pos.x, y: pos.y };

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

    for (let i = this.snakeInside.length - 1; i >= 0; i--) {
      const snekPart = this.snakeInside[i];

      const auxOldX = snekPart.position.x;
      const auxOldY = snekPart.position.y;
      snekPart.setPosition(oldPos.x, oldPos.y, 0);

      oldPos.x = auxOldX;
      oldPos.y = auxOldY;
    }
    find("Canvas").getComponent(GameManager).checkGameState();
  }

  public eatBall(ball: number): void {
    const part = this.spawnBody(ball);
    if (this.snakeInside.length >= 3) {
      this.matchCheck(part);
    }
  }

  private matchCheck(part: Node): void {
    const index = this.snakeInside.indexOf(part);
    const type1 = part.getComponent(Sprite).spriteFrame.name;
    const type2 =
      this.snakeInside[index - 1].getComponent(Sprite).spriteFrame.name;
    const type3 =
      this.snakeInside[index - 2].getComponent(Sprite).spriteFrame.name;

    if (type1 == type2 && type2 == type3) {
      part.destroy();
      this.snakeInside[index - 1].destroy();
      this.snakeInside[index - 2].destroy();

      this.snakeInside.splice(index - 2, 3);
    }
  }

  private spawnBody(color: number): Node {
    const snekPart: Node = instantiate(this.bodyPrefab);
    find("Canvas/Snake").addChild(snekPart);
    this.snakeInside.push(snekPart);

    snekPart.getComponent(Sprite).spriteFrame = this.spriteArray[color];
    let pos = find("Canvas/Snake/Head").getPosition();
    pos = new Vec3(Math.round(pos.x), Math.round(pos.y), 0);
    snekPart.setPosition(pos);
    return snekPart;
  }
}
