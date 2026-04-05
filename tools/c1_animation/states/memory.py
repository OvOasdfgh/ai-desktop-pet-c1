"""Memory-related states: recall, learn, forget."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("memory")
def state_recall():
    """Antenna lights up with aha moment when remembering past conversation."""
    return AnimationState(
        name="recall",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_UP,
                'eye_right': EYE_LOOK_UP,
                'antenna': ANTENNA_NORMAL,
            }, overlay_pixels=OVERLAY_BUBBLE_1),  # searching memory, 1 bubble
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_GLOW,
            }, overlay_pixels=OVERLAY_BUBBLE_2),  # glow, 2 bubbles
            FrameDiff(
                offset_y=-3,
                zone_overrides={
                    'antenna': ANTENNA_GLOW,
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,

                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                ],
                overlay_pixels=OVERLAY_BUBBLE_3,
            ),  # big aha pop! all 3 bubbles
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'antenna': ANTENNA_GLOW,
                },
                overlay_pixels=OVERLAY_BUBBLE_3,
            ),  # settling, all 3 bubbles
        ],
        loop=False,
        fps=3,
    )


@register("memory")
def state_learn():
    """Satisfied nod when learning something new about user."""
    return AnimationState(
        name="learn",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_SQUINT_HAPPY,
                'eye_right': EYE_SQUINT_HAPPY,
                'antenna': ANTENNA_NORMAL,

            }, overlay_pixels=OVERLAY_LIGHTBULB),  # start, antenna normal, lightbulb, grin
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_PERKED,

                },
                overlay_pixels=OVERLAY_LIGHTBULB,
            ),  # slight lift before nod, lightbulb, grin
            FrameDiff(
                offset_y=2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_PERKED,

                },
                overlay_pixels=OVERLAY_LIGHTBULB,
            ),  # deep nod, lightbulb, grin
            FrameDiff(zone_overrides={
                'eye_left': EYE_SQUINT_HAPPY,
                'eye_right': EYE_SQUINT_HAPPY,
                'antenna': ANTENNA_NORMAL,
            }, overlay_pixels=OVERLAY_LIGHTBULB),  # back up, antenna normal, lightbulb
        ],
        loop=False,
        fps=3,
    )


@register("memory")
def state_forget():
    """Hesitation when can't quite remember."""
    return AnimationState(
        name="forget",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_UP,
                'eye_right': EYE_LOOK_UP,
                'mouth': MOUTH_FLAT,
                'antenna': ANTENNA_LEAN_LEFT,
            }),  # trying to remember
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_LOOK_UP,
                    'eye_right': EYE_LOOK_UP,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_DROOPED,
                },
            ),  # sinking hesitation
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_RIGHT,
                'eye_right': EYE_LOOK_RIGHT,
                'mouth': MOUTH_FLAT,
                'antenna': ANTENNA_LEAN_RIGHT,
            }),  # give up, look away
        ],
        loop=False,
        fps=2,
    )
