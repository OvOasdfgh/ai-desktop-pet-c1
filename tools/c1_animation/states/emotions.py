"""Emotion states: happy, excited, sad, surprised, love, comfort."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("emotions")
def state_happy():
    """Bounce jump when happy."""
    return AnimationState(
        name="happy",
        frames=[
            FrameDiff(offset_y=0),  # neutral start
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_BOUNCE,

                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # ascending, hands up, grin
            FrameDiff(
                offset_y=-4,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_BOUNCE,

                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # peak! hands up, grin
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_BOUNCE,

                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # descending, hands up, grin
            FrameDiff(
                offset_y=0,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                },
            ),  # landing
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                },
            ),  # bounce recoil
        ],
        loop=False,
        fps=5,
    )


@register("emotions")
def state_excited():
    """Antenna fast sway + double bounce."""
    return AnimationState(
        name="excited",
        frames=[
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'antenna': ANTENNA_FAST_LEFT,
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,

                },
                pixel_overrides=RAISED_HAND_LEFT,
            ),  # F0: bounce 1 up, no rays yet
            FrameDiff(
                offset_y=-3,
                zone_overrides={
                    'antenna': ANTENNA_FAST_RIGHT,
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,

                },
                pixel_overrides=RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_RAY_SHORT,
            ),  # F1: bounce 1 peak, short rays appear
            FrameDiff(
                offset_y=0,
                zone_overrides={
                    'antenna': ANTENNA_FAST_RIGHT,
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'mouth': MOUTH_WIDE,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                },
                overlay_pixels=OVERLAY_RAY_SHORT,
            ),  # F2: land, short rays hold
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'antenna': ANTENNA_FAST_LEFT,
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,

                },
                pixel_overrides=RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_RAY_FULL,
            ),  # F3: bounce 2 up, full rays appear
            FrameDiff(
                offset_y=-4,
                zone_overrides={
                    'antenna': ANTENNA_FAST_RIGHT,
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,

                },
                pixel_overrides=RAISED_HAND_LEFT,
                overlay_pixels=OVERLAY_RAY_FULL,
            ),  # F4: bounce 2 peak! full rays at climax
            FrameDiff(
                offset_y=0,
                zone_overrides={
                    'antenna': ANTENNA_FAST_LEFT,
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'mouth': MOUTH_WIDE,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                },
                overlay_pixels=OVERLAY_RAY_FULL,
            ),  # F5: land, full rays hold
        ],
        loop=False,
        fps=6,
    )


@register("emotions")
def state_sad():
    """Antenna droops, body sinks."""
    return AnimationState(
        name="sad",
        frames=[
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_NORMAL,
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'mouth': MOUTH_SAD,
                'blush_left': BLUSH_HIDDEN,
                'blush_right': BLUSH_HIDDEN,
            }, pixel_overrides=[
                (16, 14, 'mouth'), (16, 15, 'mouth'),
            ], overlay_pixels=OVERLAY_TEAR),  # sad start, full eyes + tear, blush hidden
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'antenna': ANTENNA_DROOPED,
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'mouth': MOUTH_SAD,
                    'blush_left': BLUSH_HIDDEN,
                    'blush_right': BLUSH_HIDDEN,
                },
                pixel_overrides=[
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_TEAR,
            ),  # sinking, full eyes + tear, blush hidden
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'antenna': ANTENNA_DROOPED,
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'mouth': MOUTH_SAD,
                    'blush_left': BLUSH_HIDDEN,
                    'blush_right': BLUSH_HIDDEN,
                },
                pixel_overrides=[
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_TEAR,
            ),  # deeper sink, blush hidden, tear
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'antenna': ANTENNA_DROOPED,
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'mouth': MOUTH_SAD,
                    'blush_left': BLUSH_HIDDEN,
                    'blush_right': BLUSH_HIDDEN,
                },
                pixel_overrides=[
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_TEAR,
            ),  # hold at bottom, blush hidden, tear
        ],
        loop=False,
        fps=2,
    )


@register("emotions")
def state_surprised():
    """Antenna straight up, pop up."""
    return AnimationState(
        name="surprised",
        frames=[
            FrameDiff(
                offset_y=-3,
                zone_overrides={
                    'antenna': ANTENNA_STRAIGHT,
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_STARBURST,
            ),  # big pop up, starburst
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'antenna': ANTENNA_WIDE,
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ] + ANTENNA_WIDE_LEFT_EXT,
                overlay_pixels=OVERLAY_STARBURST,
            ),  # settling, antenna wide, starburst
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_NORMAL,
                'eye_left': EYE_WIDE,
                'eye_right': EYE_WIDE,
                'mouth': MOUTH_NORMAL,
            }, pixel_overrides=[
                (11, 10, 'eye'), (11, 11, 'eye'),
                (11, 18, 'eye'), (11, 19, 'eye'),
                (16, 14, 'mouth'), (16, 15, 'mouth'),
            ], overlay_pixels=OVERLAY_STARBURST),  # held pose, antenna normal, starburst
        ],
        loop=False,
        fps=5,
    )


@register("emotions")
def state_love():
    """Hearts float up."""
    return AnimationState(
        name="love",
        frames=[
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_HEART,

                },
                overlay_pixels=OVERLAY_HEART_RIGHT,
            ),  # heart right, grin
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_HEART,

                },
                overlay_pixels=OVERLAY_HEART_LEFT,
            ),  # float up, grin
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_HEART,

                },
                overlay_pixels=OVERLAY_HEART_RIGHT + OVERLAY_HEART_LEFT,
            ),  # gentle descent, both hearts, grin
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_HEART,

                },
                overlay_pixels=OVERLAY_HEART_RIGHT + OVERLAY_HEART_LEFT,
            ),  # settle, both hearts, grin
        ],
        loop=False,
        fps=3,
    )


@register("emotions")
def state_comfort():
    """Gentle lean with warm expression to comfort user."""
    return AnimationState(
        name="comfort",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
                'antenna': ANTENNA_NORMAL,
            }),  # gentle start, antenna normal
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_LEAN_RIGHT,

                },
                pixel_overrides=RAISED_HAND_RIGHT,
            ),  # warm lean forward, grin
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_CURL,

                },
                pixel_overrides=RAISED_HAND_RIGHT,
            ),  # settle back, grin, curl
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_CURL,

                },
                pixel_overrides=RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_HEART_RIGHT,
            ),  # heart appears, grin, curl
        ],
        loop=False,
        fps=2,
    )
