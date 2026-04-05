"""Conversation lifecycle states: reading, thinking, speaking, confused, error."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("conversation")
def state_reading():
    """Antenna perks up, focused eyes when receiving user message."""
    return AnimationState(
        name="reading",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_LEFT,
                'eye_right': EYE_LOOK_LEFT,
                'antenna': ANTENNA_PERKED,
            }),  # shine bottom-left
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'antenna': ANTENNA_PERKED,
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                },
            ),  # shine bottom-right
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_PERKED,
                'eye_left': EYE_LOOK_RIGHT,
                'eye_right': EYE_LOOK_RIGHT,
            }),  # shine top-right
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_PERKED,
                'eye_left': EYE_LOOK_UP,
                'eye_right': EYE_LOOK_UP,
            }),  # shine top-left (completes full cycle)
        ],
        loop=False,
        fps=3,
    )


@register("conversation")
def state_thinking():
    """Antenna glows, eyes look up while AI generates response."""
    return AnimationState(
        name="thinking",
        frames=[
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_GLOW,
                'eye_left': EYE_LOOK_UP,
                'eye_right': EYE_LOOK_UP,
                'mouth': MOUTH_TINY,
            }),  # glow + look up + pout
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'antenna': ANTENNA_NORMAL,
                    'eye_left': EYE_LOOK_UP,
                    'eye_right': EYE_LOOK_UP,
                },
                overlay_pixels=OVERLAY_SPARKLE_1,
            ),  # rise + sparkle
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'antenna': ANTENNA_GLOW,
                    'eye_left': EYE_LOOK_UP,
                    'eye_right': EYE_LOOK_UP,
                },
            ),  # float up thinking
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_GLOW,
                'eye_left': EYE_LOOK_UP,
                'eye_right': EYE_LOOK_UP,
                'mouth': MOUTH_TINY,
            }),  # back down + pout
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'antenna': ANTENNA_NORMAL,
                    'eye_left': EYE_LOOK_UP,
                    'eye_right': EYE_LOOK_UP,
                },
                overlay_pixels=OVERLAY_SPARKLE_2,
            ),  # sink + sparkle
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_NORMAL,
                'eye_left': EYE_LOOK_UP,
                'eye_right': EYE_LOOK_UP,
            }, overlay_pixels=OVERLAY_SPARKLE_1),  # back to center
        ],
        loop=True,
        fps=4,
    )


@register("conversation")
def state_speaking():
    """Mouth animates as AI outputs response text."""
    return AnimationState(
        name="speaking",
        frames=[
            FrameDiff(zone_overrides={
                'mouth': MOUTH_NORMAL,
            }),  # closed
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'mouth': MOUTH_OPEN,
                    'antenna': ANTENNA_LEAN_RIGHT,
                },
                pixel_overrides=[
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ] + RAISED_HAND_RIGHT,
            ),  # open + bounce + hand gesture + antenna right
            FrameDiff(zone_overrides={
                'mouth': MOUTH_NORMAL,
            }),  # closed
            FrameDiff(zone_overrides={
                'mouth': MOUTH_WIDE,
            }),  # wide emphasis
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'mouth': MOUTH_OPEN,
                    'antenna': ANTENNA_LEAN_LEFT,
                },
                pixel_overrides=[
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ] + RAISED_HAND_LEFT,
            ),  # bigger bounce + open + left hand gesture + antenna left
            FrameDiff(zone_overrides={
                'mouth': MOUTH_NORMAL,
            }),  # back to closed
        ],
        loop=True,
        fps=5,
    )


@register("conversation")
def state_confused():
    """Head tilt feel, question mark overlay."""
    return AnimationState(
        name="confused",
        frames=[
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_DOTS,
                    'eye_right': EYE_DOTS,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_LEAN_RIGHT,
                },
                pixel_overrides=RAISED_HAND_LEFT,
                overlay_pixels=OVERLAY_QUESTION,
            ),  # tilt right, left hand up
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_DOTS,
                    'eye_right': EYE_DOTS,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_LEAN_LEFT,
                },
                pixel_overrides=RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_QUESTION,
            ),  # sink + tilt left, right hand up
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_DOTS,
                    'eye_right': EYE_DOTS,
                    'mouth': MOUTH_FLAT,
                    'antenna': ANTENNA_LEAN_LEFT,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
                overlay_pixels=OVERLAY_QUESTION,
            ),  # hold tilt, both hands up (full shrug)
            FrameDiff(zone_overrides={
                'eye_left': EYE_DOTS,
                'eye_right': EYE_DOTS,
                'mouth': MOUTH_FLAT,
            }, overlay_pixels=OVERLAY_QUESTION),  # center, hand down
        ],
        loop=False,
        fps=3,
    )


@register("conversation")
def state_error():
    """Stumble and recover when API errors."""
    return AnimationState(
        name="error",
        frames=[
            FrameDiff(
                offset_y=3,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_STRAIGHT,
                    'blush_left': BLUSH_HIDDEN,
                    'blush_right': BLUSH_HIDDEN,
                },
                overlay_pixels=OVERLAY_X_MARK,
            ),  # big stumble, antenna straight, blush hidden, x mark
            FrameDiff(
                offset_y=1,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_DROOPED,
                    'blush_left': BLUSH_HIDDEN,
                    'blush_right': BLUSH_HIDDEN,
                },
                overlay_pixels=OVERLAY_X_MARK,
            ),  # half recover, blush hidden, x mark
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'antenna': ANTENNA_DROOPED,
                    'blush_left': BLUSH_HIDDEN,
                    'blush_right': BLUSH_HIDDEN,
                },
                overlay_pixels=OVERLAY_X_MARK,
            ),  # opening eyes, blush hidden, x mark
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_DROOPED,
            }),  # recover, antenna drooped to normal
        ],
        loop=False,
        fps=3,
    )
