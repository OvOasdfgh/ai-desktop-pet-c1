"""Generate animated GIFs for all C1 animation states.

Each GIF plays at the state's configured fps.
Non-looping animations play once then hold the last frame briefly.
Looping animations play 3 full cycles.

Output: output/gifs/<group>/<state_name>.gif
Does NOT modify any existing files.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from PIL import Image, ImageDraw
from c1_animation.base import SIZE, CANVAS_HEIGHT, SCALE
from c1_animation.frame_engine import render_state, scale_image
from c1_animation.states import get_all_states

# Import all state modules to trigger registration
import c1_animation.states.basic
import c1_animation.states.conversation
import c1_animation.states.emotions
import c1_animation.states.environment
import c1_animation.states.memory
import c1_animation.states.movement
import c1_animation.states.multimedia
import c1_animation.states.proactive
import c1_animation.states.user_interaction


def make_checker(width, height, cell=16):
    """Create a checkerboard background for transparency."""
    img = Image.new('RGBA', (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    for cy in range(0, height, cell):
        for cx in range(0, width, cell):
            if (cx // cell + cy // cell) % 2 == 0:
                draw.rectangle([cx, cy, cx + cell - 1, cy + cell - 1],
                               fill=(220, 220, 220, 255))
    return img


def composite_on_checker(frame, checker):
    """Paste a frame onto a checkerboard background."""
    result = checker.copy()
    result.paste(frame, (0, 0), frame)
    return result.convert('RGBA')


def generate_gif(state, output_dir):
    """Generate an animated GIF for one state."""
    frames = render_state(state)
    pw = SIZE * SCALE
    ph = CANVAS_HEIGHT * SCALE
    checker = make_checker(pw, ph)

    # Scale and composite each frame
    composited = []
    for f in frames:
        scaled = f.resize((pw, ph), Image.NEAREST)
        composited.append(composite_on_checker(scaled, checker))

    # Build frame sequence
    if state.loop:
        # Loop 3 times
        sequence = composited * 3
    else:
        # Play once, hold last frame for 1 second
        sequence = list(composited)
        hold_frames = max(1, state.fps)  # hold for ~1 second
        sequence.extend([composited[-1]] * hold_frames)

    # Convert to P mode for GIF
    gif_frames = []
    for img in sequence:
        rgb = img.convert('RGB')
        gif_frames.append(rgb)

    # Frame duration in ms
    duration_ms = int(1000 / state.fps)

    # Save GIF
    group_dir = os.path.join(output_dir, state.group or 'ungrouped')
    os.makedirs(group_dir, exist_ok=True)
    path = os.path.join(group_dir, f'{state.name}.gif')

    gif_frames[0].save(
        path,
        save_all=True,
        append_images=gif_frames[1:],
        duration=duration_ms,
        loop=0,  # loop forever in viewer
    )
    return path


def main():
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'output', 'gifs')
    os.makedirs(output_dir, exist_ok=True)

    states = get_all_states()
    print(f"Generating GIFs for {len(states)} states...")

    for name in sorted(states):
        state = states[name]
        path = generate_gif(state, output_dir)
        print(f"  {name:20s} ({len(state.frames)}f @ {state.fps}fps) -> {os.path.basename(path)}")

    print(f"\nDone! GIFs saved to: {output_dir}")


if __name__ == '__main__':
    main()
