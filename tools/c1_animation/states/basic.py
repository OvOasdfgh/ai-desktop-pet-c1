"""Basic animation states: idle, blink, idle_look, idle_stretch."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("basic")
def state_idle():
    """Breathing bob: body shifts up and down gently."""
    return AnimationState(
        name="idle",
        frames=[
            FrameDiff(offset_y=0),     # neutral
            FrameDiff(offset_y=-1),    # rising
            FrameDiff(offset_y=-3, zone_overrides={
                'antenna': ANTENNA_PERKED,
                'mouth': MOUTH_TINY,
            }),                         # breath peak, antenna perks, tiny mouth
            FrameDiff(offset_y=-1),    # descending
            FrameDiff(offset_y=0),     # neutral
            FrameDiff(offset_y=2),     # settle down
        ],
        loop=True,
        fps=4,
    )


@register("basic")
def state_blink():
    """Quick blink: eyes close and reopen."""
    return AnimationState(
        name="blink",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),  # eyes open
            FrameDiff(zone_overrides={
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
            }),
            FrameDiff(zone_overrides={
                'eye_left': EYE_CLOSED,
                'eye_right': EYE_CLOSED,
            }),
        ],
        loop=False,
        fps=6,
    )


@register("basic")
def state_idle_look():
    """Glance left then right."""
    return AnimationState(
        name="idle_look",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_LEFT,
                'eye_right': EYE_LOOK_LEFT,
                'antenna': ANTENNA_LEAN_LEFT,
            }),  # shine bottom-left
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),  # shine bottom-right
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_RIGHT,
                'eye_right': EYE_LOOK_RIGHT,
                'antenna': ANTENNA_LEAN_RIGHT,
            }),  # shine top-right
            FrameDiff(zone_overrides={
                'eye_left': EYE_LOOK_UP,
                'eye_right': EYE_LOOK_UP,
            }),  # shine top-left (completes full cycle)
        ],
        loop=False,
        fps=3,
    )


@register("basic")
def state_idle_stretch():
    """Stretch: body up, hands out, then settle."""
    return AnimationState(
        name="idle_stretch",
        frames=[
            FrameDiff(offset_y=0, zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_DROOPED,
            }),  # normal, antenna drooped
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'antenna': ANTENNA_STRAIGHT,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # rising, antenna straight
            FrameDiff(
                offset_y=-3,
                zone_overrides={
                    'eye_left': EYE_CLOSED,
                    'eye_right': EYE_CLOSED,
                    'antenna': ANTENNA_WIDE,
                    'mouth': MOUTH_WIDE,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT + ANTENNA_WIDE_LEFT_EXT,
            ),  # full stretch peak, antenna wide, wide mouth
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                    'antenna': ANTENNA_STRAIGHT,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # descending, eyes opening, antenna straight
            FrameDiff(offset_y=0, zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_NORMAL,
            }),  # settle back, antenna normal
        ],
        loop=False,
        fps=3,
    )
