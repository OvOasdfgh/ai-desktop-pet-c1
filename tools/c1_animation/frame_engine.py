"""Frame engine: apply diffs to generate animation frames."""

import copy
from dataclasses import dataclass, field
from typing import Optional
from PIL import Image

from .base import BASE_GRID, ZONE_MAP, PALETTE, SIZE, CANVAS_HEIGHT, PADDING_TOP, SCALE


@dataclass
class FrameDiff:
    """Describes how one frame differs from the base C1 grid."""
    offset_y: int = 0                                      # vertical shift (-4 to +4)
    zone_overrides: Optional[dict] = None                  # zone_name -> 2D sub-grid
    pixel_overrides: Optional[list] = None                 # [(row, col, color_name), ...]
    overlay_pixels: Optional[list] = None                  # [(row, col, color_name), ...] added on top

    def __post_init__(self):
        if self.zone_overrides is None:
            self.zone_overrides = {}
        if self.pixel_overrides is None:
            self.pixel_overrides = []
        if self.overlay_pixels is None:
            self.overlay_pixels = []


@dataclass
class AnimationState:
    """An animation state with multiple frames."""
    name: str
    frames: list                   # list of FrameDiff
    loop: bool = False
    fps: int = 4
    group: str = ''


def apply_diff(diff: FrameDiff) -> list:
    """Apply a FrameDiff to the base grid and return a CANVAS_HEIGHT-row canvas."""
    # Deep copy base
    grid = copy.deepcopy(BASE_GRID)

    # Create padded canvas (CANVAS_HEIGHT rows x SIZE cols)
    canvas = [['.' for _ in range(SIZE)] for _ in range(CANVAS_HEIGHT)]

    # Place character into canvas with PADDING_TOP offset + offset_y
    total_offset = PADDING_TOP + diff.offset_y
    for r in range(SIZE):
        dest_r = r + total_offset
        if 0 <= dest_r < CANVAS_HEIGHT:
            canvas[dest_r] = grid[r][:]

    # Apply zone overrides
    for zone_name, sub_grid in diff.zone_overrides.items():
        if zone_name not in ZONE_MAP:
            continue
        anchor_r, anchor_c = ZONE_MAP[zone_name]
        anchor_r += total_offset  # adjust for padding + vertical offset
        for dr, row in enumerate(sub_grid):
            for dc, color in enumerate(row):
                if color is not None:  # None means "don't change this pixel"
                    r, c = anchor_r + dr, anchor_c + dc
                    if 0 <= r < CANVAS_HEIGHT and 0 <= c < SIZE:
                        canvas[r][c] = color

    # Apply pixel overrides (absolute positions, affected by offset)
    for r, c, color in diff.pixel_overrides:
        ar = r + total_offset
        if 0 <= ar < CANVAS_HEIGHT and 0 <= c < SIZE:
            canvas[ar][c] = color

    # Apply overlay pixels (absolute positions, adjusted by offset_y)
    for r, c, color in diff.overlay_pixels:
        ar = r + total_offset
        if 0 <= ar < CANVAS_HEIGHT and 0 <= c < SIZE:
            canvas[ar][c] = color

    return canvas


def grid_to_image(grid) -> Image.Image:
    """Convert a grid (SIZE x CANVAS_HEIGHT) to a PIL Image."""
    h = len(grid)
    w = len(grid[0]) if grid else SIZE
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, color_name in enumerate(row):
            if color_name and color_name != '.':
                rgb = PALETTE.get(color_name)
                if rgb:
                    img.putpixel((x, y), (*rgb, 255))
    return img


def render_frame(diff: FrameDiff) -> Image.Image:
    """Render a single frame diff to a PIL Image."""
    grid = apply_diff(diff)
    return grid_to_image(grid)


def render_state(state: AnimationState) -> list:
    """Render all frames of an animation state. Returns list of PIL Images."""
    return [render_frame(diff) for diff in state.frames]


def scale_image(img: Image.Image, scale: int = SCALE) -> Image.Image:
    """Scale up an image using nearest-neighbor for pixel art."""
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)
