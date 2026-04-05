"""Environment states: sleepy, sleeping, wakeup, greeting, curious, bored."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("environment")
def state_sleepy():
    """Eyelids droop, head bobs when getting drowsy."""
    return AnimationState(
        name="sleepy",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
                'antenna': ANTENNA_DROOPED,
            }, overlay_pixels=OVERLAY_SMALL_Z),  # half eyes + small z
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'antenna': ANTENNA_DROOPED,
                },
                overlay_pixels=OVERLAY_SMALL_Z,
            ),  # sinking + small z
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_YAWN,
                },
                pixel_overrides=YAWN_LOWER,
                overlay_pixels=OVERLAY_SMALL_Z,
            ),  # deep nod + small z + yawn
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_YAWN,
                },
                pixel_overrides=YAWN_LOWER,
                overlay_pixels=OVERLAY_SMALL_Z,
            ),  # hold at bottom + small z + yawn
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'antenna': ANTENNA_DROOPED,
                },
                overlay_pixels=OVERLAY_SMALL_Z,
            ),  # slowly rising + small z
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
                'antenna': ANTENNA_DROOPED,
            }, overlay_pixels=OVERLAY_SMALL_Z),  # back to start + small z
        ],
        loop=True,
        fps=2,
    )


@register("environment")
def state_sleeping():
    """Deep sleep with ZZZ."""
    return AnimationState(
        name="sleeping",
        frames=[
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_FLAT,
                },
                overlay_pixels=OVERLAY_ZZZ_1,
            ),  # breathing in
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_FLAT,
                },
                overlay_pixels=OVERLAY_ZZZ_2,
            ),  # sinking
            FrameDiff(
                offset_y=3,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_FLAT,
                },
                overlay_pixels=OVERLAY_ZZZ_1,
            ),  # deepest exhale
            FrameDiff(
                offset_y=3,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_FLAT,
                },
                overlay_pixels=OVERLAY_ZZZ_2,
            ),  # hold
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_FLAT,
                },
                overlay_pixels=OVERLAY_ZZZ_1,
            ),  # rising
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'mouth': MOUTH_FLAT,
                },
                overlay_pixels=OVERLAY_ZZZ_2,
            ),  # back to start
        ],
        loop=True,
        fps=2,
    )


@register("environment")
def state_wakeup():
    """Rub eyes and stretch when waking."""
    return AnimationState(
        name="wakeup",
        frames=[
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_NORMAL,
                    'mouth': MOUTH_YAWN,
                },
                pixel_overrides=YAWN_LOWER,
            ),  # deep start, antenna normal, yawn
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_NORMAL,
                    'mouth': MOUTH_TINY,
                },
            ),  # stirring, tiny mouth
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
                'antenna': ANTENNA_NORMAL,
            }),  # half awake
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'antenna': ANTENNA_PERKED,
                },
            ),  # stretch up
        ],
        loop=False,
        fps=2,
    )


@register("environment")
def state_greeting():
    """Wave hand for morning greeting."""
    return AnimationState(
        name="greeting",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_SQUINT_HAPPY,
                'eye_right': EYE_SQUINT_HAPPY,
            }),  # hand down
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_WIDE,
                },
                pixel_overrides=RAISED_HAND_LEFT + ANTENNA_WIDE_LEFT_EXT,
            ),  # wave 1, hand up, antenna wide
            FrameDiff(zone_overrides={
                'eye_left': EYE_SQUINT_HAPPY,
                'eye_right': EYE_SQUINT_HAPPY,
            }),  # hand down
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_WIDE,
                },
                pixel_overrides=RAISED_HAND_RIGHT + ANTENNA_WIDE_LEFT_EXT,
            ),  # wave 2, right hand up, antenna wide
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                },
            ),  # winding down, hand down
            FrameDiff(zone_overrides={
                'eye_left': EYE_SQUINT_HAPPY,
                'eye_right': EYE_SQUINT_HAPPY,
            }),  # settle
        ],
        loop=False,
        fps=4,
    )


@register("environment")
def state_curious():
    """Antenna turns toward direction of interest."""
    return AnimationState(
        name="curious",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),  # normal state, hear something
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_LEAN_LEFT,
                'eye_left': EYE_WIDE,
                'eye_right': EYE_NORMAL,
            }, pixel_overrides=[
                (11, 10, 'eye'), (11, 11, 'eye'),
            ] + RAISED_HAND_LEFT),  # left eye wide + antenna leans left + left hand out, exploring
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_LEAN_LEFT,
                'eye_left': EYE_WIDE,
                'eye_right': EYE_NORMAL,
            }, pixel_overrides=[
                (11, 10, 'eye'), (11, 11, 'eye'),
            ] + RAISED_HAND_LEFT),  # hold — still watching, hand out
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),  # settle back to normal
        ],
        loop=False,
        fps=3,
    )


@register("environment")
def state_bored():
    """Sigh, look at user expectantly."""
    return AnimationState(
        name="bored",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
                'mouth': MOUTH_FLAT,
                'antenna': ANTENNA_FLAT,
            }),  # bored start, both half-closed
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_LOOK_RIGHT,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_FLAT,
                },
            ),  # right eye peeks at user
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_FLAT,
                },
            ),  # close back, deep sigh
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_LOOK_RIGHT,
                    'eye_right': EYE_HALF,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_FLAT,
                },
            ),  # left eye peeks at user
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_FLAT,
                },
            ),  # close back, transition
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_RIGHT,
                'eye_right': EYE_LOOK_RIGHT,
                'mouth': MOUTH_FLAT,
                'antenna': ANTENNA_NORMAL,
            }),  # both eyes look at user, back to base antenna
        ],
        loop=False,
        fps=2,
    )
