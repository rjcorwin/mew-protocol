import Phaser from 'phaser';

/**
 * Manages gamepad/controller support, including connection detection,
 * notification display, and gamepad state access.
 *
 * This manager handles the full lifecycle of gamepad input, providing
 * a centralized way for other systems (input handlers) to access gamepad state.
 *
 * Responsibilities:
 * - Detect gamepad connections and disconnections
 * - Display on-screen notifications for gamepad events
 * - Provide gamepad access to other systems via getGamepad()
 * - Handle already-connected gamepads on startup
 *
 * Dependencies:
 * - Phaser.Input.Gamepad plugin for gamepad support
 * - Phaser.GameObjects.Text for notifications
 *
 * @example
 * ```typescript
 * const gamepadManager = new GamepadManager(scene);
 * gamepadManager.initialize();
 *
 * // Access gamepad from other systems
 * const pad = gamepadManager.getGamepad();
 * if (pad) {
 *   const leftStickX = pad.leftStick.x;
 * }
 * ```
 */
export class GamepadManager {
  private gamepad: Phaser.Input.Gamepad.Gamepad | null = null;
  private notificationText?: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {}

  /**
   * Initialize gamepad support - call this from scene's create() method
   */
  initialize(): void {
    if (!this.scene.input.gamepad) {
      console.warn('⚠ Gamepad plugin not available');
      return;
    }

    // Check for already-connected gamepads
    if (this.scene.input.gamepad.total > 0) {
      this.gamepad = this.scene.input.gamepad.getPad(0);
      this.onGamepadConnected(this.gamepad!);
    }

    // Listen for gamepad connections
    this.scene.input.gamepad.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
      console.log('🎮 Gamepad connected:', pad.id);
      this.gamepad = pad;
      this.onGamepadConnected(pad);
    });

    // Listen for gamepad disconnections
    this.scene.input.gamepad.on('disconnected', () => {
      console.log('🎮 Gamepad disconnected');
      this.gamepad = null;
      this.showNotification('Controller disconnected', 3000);
    });
  }

  /**
   * Get the current gamepad instance (null if no gamepad connected)
   */
  getGamepad(): Phaser.Input.Gamepad.Gamepad | null {
    return this.gamepad;
  }

  /**
   * Handle gamepad connection
   */
  private onGamepadConnected(pad: Phaser.Input.Gamepad.Gamepad): void {
    console.log('🎮 Controller ready:', pad.id);
    console.log('   Buttons:', pad.buttons.length);
    console.log('   Axes:', pad.axes.length);

    this.showNotification('Controller connected!', 3000);
  }

  /**
   * Show gamepad notification message
   */
  private showNotification(message: string, duration: number): void {
    // Remove existing notification if any
    if (this.notificationText) {
      this.notificationText.destroy();
    }

    // Create notification text (fixed to camera)
    const camera = this.scene.cameras.main;
    this.notificationText = this.scene.add.text(
      camera.centerX,
      camera.height - 100,
      message,
      {
        fontSize: '24px',
        color: '#00ff00',
        backgroundColor: '#000000aa',
        padding: { x: 20, y: 10 },
      }
    );
    this.notificationText.setOrigin(0.5, 0.5);
    this.notificationText.setScrollFactor(0);
    this.notificationText.setDepth(10000);

    // Auto-hide after duration
    this.scene.time.delayedCall(duration, () => {
      if (this.notificationText) {
        this.notificationText.destroy();
        this.notificationText = undefined;
      }
    });
  }
}
