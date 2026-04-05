"""Multimedia states: listening, voice_reply, viewing, show_image."""

from ..frame_engine import AnimationState, FrameDiff
from ..components import *
from . import register


@register("multimedia")
def state_listening():
    """Antenna vibrates with sound, attentive expression during voice input."""
    return AnimationState(
        name="listening",
        frames=[
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_VIBRATE_L,
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
            }),  # vibrate left + half eyes
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'eye_left': EYE_NORMAL,
                    'eye_right': EYE_NORMAL,
                    'antenna': ANTENNA_VIBRATE_R,
                },
            ),  # bounce + vibrate right
            FrameDiff(zone_overrides={
                'antenna': ANTENNA_VIBRATE_L,
                'eye_left': EYE_HALF,
                'eye_right': EYE_HALF,
            }),  # vibrate left
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_VIBRATE_R,
            }),  # vibrate right
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'antenna': ANTENNA_VIBRATE_L,
                    'eye_left': EYE_HALF,
                    'eye_right': EYE_HALF,
                },
            ),  # bounce + vibrate left
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_VIBRATE_R,
            }),  # vibrate right
        ],
        loop=True,
        fps=5,
    )


@register("multimedia")
def state_voice_reply():
    """Wider mouth movement during voice output, with musical note."""
    return AnimationState(
        name="voice_reply",
        frames=[
            FrameDiff(zone_overrides={
                'mouth': MOUTH_WIDE,
                'antenna': ANTENNA_FAST_RIGHT,
            }, overlay_pixels=OVERLAY_NOTE_1),  # wide + note 1 + antenna fast right
            FrameDiff(
                offset_y=-1,
                zone_overrides={
                    'mouth': MOUTH_NORMAL,
                    'antenna': ANTENNA_NORMAL,
                },
            ),  # bounce + closed + antenna normal
            FrameDiff(zone_overrides={
                'mouth': MOUTH_NORMAL,
                'antenna': ANTENNA_NORMAL,
            }),  # closed + antenna normal
            FrameDiff(zone_overrides={
                'mouth': MOUTH_WIDE,
                'antenna': ANTENNA_FAST_LEFT,
            }, overlay_pixels=OVERLAY_NOTE_2),  # wide + note 2 + antenna fast left
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'mouth': MOUTH_OPEN,
                    'antenna': ANTENNA_FAST_RIGHT,
                },
                pixel_overrides=[
                    (16, 14, 'mouth'), (16, 15, 'mouth'),
                ],
                overlay_pixels=OVERLAY_NOTE_1,
            ),  # big bounce + open + note 1 + antenna fast right
            FrameDiff(zone_overrides={
                'mouth': MOUTH_NORMAL,
                'antenna': ANTENNA_FAST_LEFT,
            }, overlay_pixels=OVERLAY_NOTE_2),  # back + note 2 + antenna fast left
        ],
        loop=True,
        fps=5,
    )


@register("multimedia")
def state_viewing():
    """Eyes widen and lean in when receiving an image."""
    return AnimationState(
        name="viewing",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
                'antenna': ANTENNA_PERKED,
            }),  # perk
            FrameDiff(zone_overrides={
                'eye_left': EYE_WIDE,
                'eye_right': EYE_WIDE,
                'antenna': ANTENNA_PERKED,
            }, pixel_overrides=[
                (11, 10, 'eye'), (11, 11, 'eye'),
                (11, 18, 'eye'), (11, 19, 'eye'),
            ]),  # wide eyes
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_WIDE,
                    'eye_right': EYE_WIDE,
                    'antenna': ANTENNA_NORMAL,
                },
                pixel_overrides=[
                    (11, 10, 'eye'), (11, 11, 'eye'),
                    (11, 18, 'eye'), (11, 19, 'eye'),
                ],
            ),  # lean in, antenna normal
        ],
        loop=False,
        fps=3,
    )


@register("multimedia")
def state_show_image():
    """Hands up presenting when AI sends an image."""
    return AnimationState(
        name="show_image",
        frames=[
            FrameDiff(zone_overrides={
                'eye_left': EYE_NORMAL,
                'eye_right': EYE_NORMAL,
            }),  # normal
            FrameDiff(
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_ALERT,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # hands up, antenna alert
            FrameDiff(
                offset_y=-2,
                zone_overrides={
                    'eye_left': EYE_SQUINT_HAPPY,
                    'eye_right': EYE_SQUINT_HAPPY,
                    'antenna': ANTENNA_ALERT,
                },
                pixel_overrides=RAISED_HAND_LEFT + RAISED_HAND_RIGHT,
            ),  # present, antenna alert
        ],
        loop=False,
        fps=3,
    )
