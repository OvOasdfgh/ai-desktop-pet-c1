"""Generate preview images and sprite sheets."""

import os
import json
from PIL import Image, ImageDraw, ImageFont

from .base import SIZE, CANVAS_HEIGHT, SCALE
from .frame_engine import render_state, scale_image

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'output')


def _get_font(size=13):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        return ImageFont.load_default()


def _draw_checker_bg(draw, x, y, w, h, cell=32):
    """Draw a checkerboard background for transparency display."""
    for cy in range(0, h, cell):
        for cx in range(0, w, cell):
            color = (235, 232, 228) if (cx // cell + cy // cell) % 2 == 0 else (245, 242, 238)
            draw.rectangle([x + cx, y + cy, x + cx + cell - 1, y + cy + cell - 1], fill=color)


def generate_sprite_sheet(state, output_dir=None):
    """Generate a horizontal sprite sheet for one animation state."""
    if output_dir is None:
        output_dir = os.path.join(OUTPUT_DIR, 'sheets')
    os.makedirs(output_dir, exist_ok=True)

    frames = render_state(state)
    n = len(frames)

    # Native size sheet
    sheet = Image.new('RGBA', (SIZE * n, CANVAS_HEIGHT), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        sheet.paste(frame, (idx * SIZE, 0))
    sheet.save(os.path.join(output_dir, f'{state.name}_sheet.png'))

    # Scaled sheet
    scaled = scale_image(sheet)
    scaled.save(os.path.join(output_dir, f'{state.name}_sheet_{SCALE}x.png'))

    return sheet


def generate_individual_frames(state, output_dir=None):
    """Save each frame as an individual PNG."""
    if output_dir is None:
        output_dir = os.path.join(OUTPUT_DIR, 'frames')
    os.makedirs(output_dir, exist_ok=True)

    frames = render_state(state)
    for idx, frame in enumerate(frames):
        frame.save(os.path.join(output_dir, f'{state.name}_{idx}.png'))
    return frames


def generate_group_preview(states_dict, group_name, output_dir=None):
    """Generate a preview image showing all states in a group."""
    if output_dir is None:
        output_dir = os.path.join(OUTPUT_DIR, 'previews')
    os.makedirs(output_dir, exist_ok=True)

    states = list(states_dict.values())
    if not states:
        return

    font = _get_font(13)
    margin = 12
    label_h = 20
    frame_w = SIZE * SCALE
    frame_h = CANVAS_HEIGHT * SCALE
    max_frames = max(len(s.frames) for s in states)

    row_h = frame_h + label_h + margin
    total_w = margin + max_frames * (frame_w + 8) + margin + 120  # 120 for label
    total_h = margin + len(states) * row_h + margin

    preview = Image.new('RGBA', (total_w, total_h), (250, 248, 245, 255))
    draw = ImageDraw.Draw(preview)

    for row_idx, state in enumerate(states):
        y = margin + row_idx * row_h
        frames = render_state(state)

        # State name label
        loop_str = " (loop)" if state.loop else ""
        label = f"{state.name}{loop_str}"
        draw.text((margin, y + frame_h // 2 - 7), label, fill=(100, 80, 80), font=font)

        # Draw each frame
        for f_idx, frame in enumerate(frames):
            x = margin + 120 + f_idx * (frame_w + 8)
            _draw_checker_bg(draw, x, y, frame_w, frame_h)
            scaled = scale_image(frame)
            preview.paste(scaled, (x, y), scaled)
            # Frame number
            draw.text((x + 2, y + frame_h + 2), f"f{f_idx}", fill=(160, 150, 150), font=font)

    path = os.path.join(output_dir, f'preview_{group_name}.png')
    preview.save(path)
    return path


def generate_master_preview(all_states, output_dir=None):
    """Generate a master catalog showing all animation states."""
    if output_dir is None:
        output_dir = os.path.join(OUTPUT_DIR, 'previews')
    os.makedirs(output_dir, exist_ok=True)

    font = _get_font(11)
    scale = 4  # Use 4x for master (smaller to fit)
    frame_w = SIZE * scale  # 128px
    frame_h = CANVAS_HEIGHT * scale  # 160px
    margin = 10
    label_h = 16
    cols = 6
    row_h = frame_h + label_h + margin

    states = list(all_states.values())
    rows = (len(states) + cols - 1) // cols
    max_frames = max((len(s.frames) for s in states), default=1)

    cell_w = max_frames * (frame_w + 4) + 8
    total_w = margin + cols * cell_w + margin
    total_h = margin + rows * row_h + margin

    preview = Image.new('RGBA', (total_w, total_h), (250, 248, 245, 255))
    draw = ImageDraw.Draw(preview)

    for idx, state in enumerate(states):
        col = idx % cols
        row = idx // cols
        base_x = margin + col * cell_w
        base_y = margin + row * row_h

        # Label
        draw.text((base_x + 2, base_y + frame_h + 1), state.name, fill=(100, 80, 80), font=font)

        # Frames
        frames = render_state(state)
        for f_idx, frame in enumerate(frames):
            x = base_x + f_idx * (frame_w + 4)
            _draw_checker_bg(draw, x, base_y, frame_w, frame_h, cell=16)
            scaled = frame.resize((frame_w, frame_h), Image.NEAREST)
            preview.paste(scaled, (x, base_y), scaled)

    path = os.path.join(output_dir, 'preview_all_states.png')
    preview.save(path)
    return path


def generate_states_json(all_states, output_dir=None):
    """Generate metadata JSON for all states."""
    if output_dir is None:
        output_dir = OUTPUT_DIR
    os.makedirs(output_dir, exist_ok=True)

    data = {}
    for name, state in all_states.items():
        data[name] = {
            'frames': len(state.frames),
            'loop': state.loop,
            'fps': state.fps,
            'group': state.group,
        }

    path = os.path.join(output_dir, 'states.json')
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    return path
