"""Proactive behavior states: want_to_talk, notify, check_in."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("proactive")
def state_want_to_talk():
    """Small bounce with hand raise when pet wants to initiate conversation."""
    return AnimationState(
        name="want_to_talk",
        frames=[
            FrameDiff(overlay_pixels=OVERLAY_ELLIPSIS),  # ground, hand down
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'antenna': ANTENNA_PERKED,
                },
                pixel_overrides=RAISED_HAND_LEFT,
                overlay_pixels=OVERLAY_ELLIPSIS,
            ),  # bounce up, antenna perks (courage building)
            FrameDiff(
                offset_y=-4,
                zone_overrides={
                    'antenna': ANTENNA_PERKED,
                    'mouth': MOUTH_TINY,
                },
                pixel_overrides=RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_ELLIPSIS,
            ),  # peak! tiny mouth (hesitating)
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'antenna': ANTENNA_PERKED,
                    'mouth': MOUTH_TINY,
                },
                pixel_overrides=RAISED_HAND_LEFT,
                overlay_pixels=OVERLAY_ELLIPSIS,
            ),  # descending, still hesitating
            FrameDiff(overlay_pixels=OVERLAY_ELLIPSIS),  # back to ground, hand down
            FrameDiff(
                offset_y=1,
                overlay_pixels=OVERLAY_ELLIPSIS,
            ),  # slight sink
        ],
        loop=True,
        fps=4,
    )


@register("proactive")
def state_notify():
    """Wave for attention with exclamation mark."""
    return AnimationState(
        name="notify",
        frames=[
            FrameDiff(
                zone_overrides={
                    'antenna': ANTENNA_STRAIGHT,
                },
                overlay_pixels=OVERLAY_EXCLAMATION,
            ),  # alert, hand down
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'antenna': ANTENNA_PERKED,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_EXCLAMATION,
            ),  # bounce, both hands up
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'antenna': ANTENNA_PERKED,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_EXCLAMATION,
            ),  # gentle descent, both hands up
            FrameDiff(
                zone_overrides={
                    'antenna': ANTENNA_STRAIGHT,
                },
                overlay_pixels=OVERLAY_EXCLAMATION,
            ),  # settle, hand down
        ],
        loop=False,
        fps=3,
    )


@register("proactive")
def state_check_in():
    """Gentle peek with warm expression to check on user."""
    return AnimationState(
        name="check_in",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
                'antenna': ANTENNA_LEAN_RIGHT,
            }),  # peek
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'antenna': ANTENNA_CURL,
                    'blush_left': BLUSH_BRIGHT,
                    'blush_right': BLUSH_BRIGHT,

                },
            ),  # lean in, antenna curl, grin
            FrameDiff(zone_overrides={
                'eye_left': EYE_SQUINT_HAPPY,
                'eye_right': EYE_SQUINT_HAPPY,
                'blush_left': BLUSH_BRIGHT,
                'blush_right': BLUSH_BRIGHT,
                'antenna': ANTENNA_CURL,

            }),  # warm smile, antenna curl, grin
        ],
        loop=False,
        fps=2,
    )
