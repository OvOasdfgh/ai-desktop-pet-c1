"""Movement states: walk, jump, fall."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("movement")
def state_walk():
    """Waddle walk along screen bottom."""
    return AnimationState(
        name="walk",
        frames=[
            FrameDiff(),  # step 1 ground
            FrameDiff(
                offset_y=-1,
                pixel_overrides=RAISED_HAND_LEFT,
            ),  # step 1 mid, left arm out
            FrameDiff(
                offset_y=-2,
                zone_overrides={'antenna': ANTENNA_BOUNCE},
                pixel_overrides=RAISED_HAND_LEFT,
            ),  # step 1 peak, antenna bounce
            FrameDiff(),  # step 2 ground
            FrameDiff(
                offset_y=-1,
                pixel_overrides=RAISED_HAND_RIGHT,
            ),  # step 2 mid, right arm out
            FrameDiff(
                offset_y=-2,
                zone_overrides={'antenna': ANTENNA_BOUNCE},
                pixel_overrides=RAISED_HAND_RIGHT,
            ),  # step 2 peak, antenna bounce
        ],
        loop=True,
        fps=5,
    )


@register("movement")
def state_jump():
    """Jump up and land with bounce."""
    return AnimationState(
        name="jump",
        frames=[
            FrameDiff(offset_y=2, zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_PERKED,
            }),     # deep crouch, antenna perked
            FrameDiff(offset_y=0, zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_PERKED,
            }),                          # launch
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_STRAIGHT,
                },
            ),  # ascending
            FrameDiff(
                offset_y=-4,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_STRAIGHT,
                },
            ),  # peak!
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'antenna': ANTENNA_PERKED,
                },
            ),  # descending
            FrameDiff(offset_y=0, zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),     # land
        ],
        loop=False,
        fps=6,
    )


@register("movement")
def state_fall():
    """Fall from edge."""
    return AnimationState(
        name="fall",
        frames=[
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                    'antenna': ANTENNA_STRAIGHT,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
            ),  # airborne
            FrameDiff(
                offset_y=0,
                zone_overrides={
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                    'antenna': ANTENNA_NORMAL,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
            ),  # mid-fall
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                },
            ),  # impact
        ],
        loop=False,
        fps=5,
    )
