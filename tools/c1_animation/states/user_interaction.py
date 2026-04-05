"""User interaction states: typing, drag, thrown, poked, petted."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("user_interaction")
def state_typing():
    """Hands sway as user types on keyboard."""
    return AnimationState(
        name="typing",
        frames=[
            FrameDiff(
                zone_overrides={'antenna': ANTENNA_VIBRATE_L},
                pixel_overrides=RAISED_HAND_LEFT,
            ),  # ground, left hand
            FrameDiff(offset_y=-1),  # bounce
            FrameDiff(
                offset_y=-2,
                zone_overrides={'antenna': ANTENNA_VIBRATE_R},
                pixel_overrides=RAISED_HAND_RIGHT,
            ),  # deep bounce, right hand
            FrameDiff(
                zone_overrides={'antenna': ANTENNA_VIBRATE_R},
                pixel_overrides=RAISED_HAND_RIGHT,
            ),  # ground, right hand
            FrameDiff(offset_y=-1),  # bounce
            FrameDiff(
                offset_y=-2,
                zone_overrides={'antenna': ANTENNA_VIBRATE_L},
                pixel_overrides=RAISED_HAND_LEFT,
            ),  # deep bounce, left hand
        ],
        loop=True,
        fps=5,
    )


@register("user_interaction")
def state_drag():
    """Suspended wiggle when dragged by cursor."""
    return AnimationState(
        name="drag",
        frames=[
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                    'antenna': ANTENNA_LEAN_LEFT,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_DIZZY_1,
            ),  # swing up-left, dizzy stars
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                    'antenna': ANTENNA_LEAN_LEFT,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_DIZZY_2,
            ),  # center-left, dizzy stars
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                    'antenna': ANTENNA_LEAN_RIGHT,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_DIZZY_1,
            ),  # swing down-right, dizzy stars
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'mouth': MOUTH_NORMAL,
                    'antenna': ANTENNA_LEAN_RIGHT,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_DIZZY_2,
            ),  # center-right, dizzy stars
        ],
        loop=True,
        fps=5,
    )


@register("user_interaction")
def state_thrown():
    """Fly through air and land with bounce after being released."""
    return AnimationState(
        name="thrown",
        frames=[
            FrameDiff(
                offset_y=-4,
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
                ] + RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # max upward throw, both hands up (panic)
            FrameDiff(
                offset_y=-1,
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
                ] + RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # mid-air transition, both hands up
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'antenna': ANTENNA_DROOPED,
                },
            ),  # landing bounce
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),  # recover
        ],
        loop=False,
        fps=5,
    )


@register("user_interaction")
def state_poked():
    """Small surprise reaction when clicked."""
    return AnimationState(
        name="poked",
        frames=[
            FrameDiff(
                offset_y=-3,
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
            ),  # big startle
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'antenna': ANTENNA_PERKED,
                },
            ),  # mid transition
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),  # settle
        ],
        loop=False,
        fps=5,
    )


@register("user_interaction")
def state_petted():
    """Happy squint when long-pressed / head patted."""
    return AnimationState(
        name="petted",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
                'blush_left': BLUSH_BRIGHT,
                'blush_right': BLUSH_BRIGHT,
                'antenna': ANTENNA_CURL,
            }, overlay_pixels=OVERLAY_WARM),  # half eyes + blush + curl + warm
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_CURL,

                },
                overlay_pixels=OVERLAY_WARM,
            ),  # nuzzle down + curl + warm + grin
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_CURL,

                },
                overlay_pixels=OVERLAY_WARM,
            ),  # deep nuzzle + curl + warm + grin
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_CURL,

                },
                overlay_pixels=OVERLAY_WARM,
            ),  # rising back + curl + warm + grin
            FrameDiff(zone_overrides={
                'eye_left': EYE_SQUINT_HAPPY,
                'eye_right': EYE_SQUINT_HAPPY,
                'blush_left': BLUSH_BRIGHT,
                'blush_right': BLUSH_BRIGHT,
                'antenna': ANTENNA_CURL,

            }, overlay_pixels=OVERLAY_WARM),  # neutral happy + curl + warm + grin
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,
                    'antenna': ANTENNA_PERKED,
                },
                overlay_pixels=OVERLAY_WARM,
            ),  # slight lift + perked + warm
        ],
        loop=True,
        fps=3,
    )
