"""Reusable component variants for C1 animation frames.

Each component is a small 2D grid (list of lists) that gets stamped onto
the base grid at the corresponding zone anchor position.

Use None to mean "don't change this pixel" (keep base).
Use '.' to mean "clear this pixel to transparent".
"""

_ = '.'
o = 'outline_c'
cr = 'cream'
e = 'eye'
s = 'eye_shine'
b = 'blush'
m = 'mouth'
a = 'accent'
p = 'pink'
pl = 'pink_light'
pd = 'pink_dark'
l = 'pink_light'
i = 'inner'

# ============================================================
# EYES (2 rows x 2 cols, anchored at ZONE_MAP['eye_left'] / ['eye_right'])
# Base: row0=[e, e], row1=[e, s]
# ============================================================

EYE_NORMAL = [
    [e, e],
    [e, s],
]

EYE_CLOSED = [
    [cr, cr],
    [o, o],   # thin line = closed eyelid
]

EYE_HALF = [
    [cr, cr],
    [e, e],   # only bottom half visible
]

EYE_LOOK_LEFT = [
    [e, e],
    [s, e],   # shine bottom-left = looking left
]

EYE_LOOK_RIGHT = [
    [e, s],
    [e, e],   # shine top-right = looking right
]

EYE_LOOK_UP = [
    [s, e],
    [e, e],   # shine top-left = looking up
]

EYE_WIDE = [
    [e, e],
    [e, s],   # same shape but we'll add extra pixels via pixel_overrides for row above
]
# Note: for truly "wide" eyes, also override row 11 pixels at eye positions to [e, e]

EYE_SQUINT_HAPPY = [
    [cr, cr],
    [m, m],   # warm mouth-colored line = happy squint (^), distinct from CLOSED[o,o] and HALF[e,e]
]

EYE_SAD = [
    [e, cr],
    [e, s],   # slightly droopy, one pixel lower feel
]

EYE_DOTS = [
    [cr, cr],
    [e, cr],  # tiny dot eyes for confusion
]

# ============================================================
# MOUTH (1 row x 4 cols, anchored at ZONE_MAP['mouth'] row 15, cols 13-16)
# Base grid at row 15: [...cr, cr, m, m, cr, cr...]  (mouth at cols 14-15)
# Zone anchor is (15, 13) so col offsets 0-3 map to cols 13-16
# ============================================================

MOUTH_NORMAL = [
    [cr, m, m, cr],   # small line mouth
]

MOUTH_OPEN = [
    [cr, m, m, cr],   # top of mouth same
]
# Pair with pixel_override at (16, 14, 'mouth'), (16, 15, 'mouth') for open bottom

MOUTH_WIDE = [
    [m, m, m, m],     # wide open
]

MOUTH_SAD = [
    [cr, cr, cr, cr],  # mouth moved down 1 row via pixel override
]
# Pair with pixel_overrides at row 16 for the sad curve

MOUTH_FLAT = [
    [cr, o, o, cr],   # flat line, slightly darker
]

# D-2d: New mouth variants

MOUTH_TINY = [
    [cr, cr, m, cr],  # single pixel dot (breathing / subtle)
]

MOUTH_YAWN = [
    [m, m, m, m],     # full row centered (yawn opening)
]
# Pair with YAWN_LOWER pixel_overrides for full yawn
YAWN_LOWER = [(16, 13, 'mouth'), (16, 14, 'mouth'), (16, 15, 'mouth'), (16, 16, 'mouth')]

# ============================================================
# ANTENNA (5 rows x 10 cols, anchored at row 2, col 11)
# Base antenna pixels (relative to anchor):
#   row0: [o,_,_,_,_,_,_,_,_,o]        (tips at col 0 and 9)
#   row1: [o,a,_,_,_,_,_,_,a,o]        (accent dots)
#   row2: [_,o,_,_,_,_,_,o,_,_]        (stems)
#   row3: [_,o,_,_,_,_,_,o,_,_]        (stems)
#   row4: [_,_,o,_,_,_,o,_,_,_]        (join head)
# ============================================================

ANTENNA_NORMAL = [
    [o,_,_,_,_,_,_,o,_,_],
    [o,a,_,_,_,_,a,o,_,_],
    [_,o,_,_,_,_,o,_,_,_],
    [_,o,_,_,_,_,o,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_PERKED = [
    [o,_,_,_,_,_,_,o,_,_],
    [o,a,_,_,_,_,a,o,_,_],
    [_,o,_,_,_,_,o,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_DROOPED = [
    [_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_],
    [o,_,_,_,_,_,_,o,_,_],
    [o,a,_,_,_,_,a,o,_,_],
    [_,o,o,_,_,o,o,_,_,_],
]

ANTENNA_STRAIGHT = [
    [_,_,o,_,_,o,_,_,_,_],
    [_,_,o,a,a,o,_,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_GLOW = [
    [o,a,_,_,_,_,a,o,_,_],
    [a,a,_,_,_,_,a,a,_,_],
    [_,o,_,_,_,_,o,_,_,_],
    [_,o,_,_,_,_,o,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_VIBRATE_L = [
    [o,_,_,_,_,_,o,_,_,_],
    [o,a,_,_,_,a,o,_,_,_],
    [o,_,_,_,_,o,_,_,_,_],
    [_,o,_,_,_,o,_,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_VIBRATE_R = [
    [_,o,_,_,_,_,_,o,_,_],
    [_,o,a,_,_,_,a,o,_,_],
    [_,_,o,_,_,_,_,o,_,_],
    [_,_,o,_,_,_,o,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_LEAN_LEFT = [
    [o,_,_,_,_,_,o,_,_,_],
    [o,a,_,_,_,a,o,_,_,_],
    [_,o,_,_,_,o,_,_,_,_],
    [_,o,_,_,_,o,_,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_LEAN_RIGHT = [
    [_,o,_,_,_,_,_,o,_,_],
    [_,o,a,_,_,_,a,o,_,_],
    [_,_,o,_,_,_,o,_,_,_],
    [_,_,o,_,_,_,o,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_FAST_LEFT = [
    [o,_,_,_,_,o,_,_,_,_],
    [o,a,_,_,a,o,_,_,_,_],
    [o,_,_,_,o,_,_,_,_,_],
    [_,o,_,_,o,_,_,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

ANTENNA_FAST_RIGHT = [
    [_,_,o,_,_,_,_,o,_,_],
    [_,_,o,a,_,_,a,o,_,_],
    [_,_,_,o,_,_,_,o,_,_],
    [_,_,_,o,_,_,o,_,_,_],
    [_,_,o,_,_,o,_,_,_,_],
]

# D-2b: New antenna variants

ANTENNA_HEART = [
    [_,_,o,a,a,o,_,_,_,_],   # tips curl inward, almost touching
    [_,o,_,_,_,_,o,_,_,_],   # stems curve out
    [o,_,_,_,_,_,_,o,_,_],   # widest point
    [_,o,_,_,_,_,o,_,_,_],   # narrowing
    [_,_,o,_,_,o,_,_,_,_],   # join head
]

ANTENNA_WIDE = [
    [_,_,_,_,_,_,_,_,o,_],   # row0: right tip at zone col 8; left tip via pixel_override at abs col 10
    [a,_,_,_,_,_,_,a,o,_],   # row1: left accent at col 0 (abs 11); right a+o at cols 7,8
    [o,_,_,_,_,_,_,o,_,_],   # row2: stems at cols 0,7 (abs 11,18)
    [_,o,_,_,_,_,o,_,_,_],   # row3: at cols 1,6 (abs 12,17)
    [_,_,o,_,_,o,_,_,_,_],   # row4: join head (unchanged)
]

# Pixel overrides for ANTENNA_WIDE left-side extension (abs col 10, outside zone)
ANTENNA_WIDE_LEFT_EXT = [
    (2, 10, 'outline_c'),   # row 0: left tip at abs col 10
    (3, 10, 'outline_c'),   # row 1: left outer at abs col 10
]

ANTENNA_FLAT = [
    [_,_,_,_,_,_,_,_,_,_],   # empty
    [_,_,_,_,_,_,_,_,_,_],   # empty
    [_,_,_,_,_,_,_,_,_,_],   # empty
    [o,o,a,_,_,a,o,o,_,_],   # flat horizontal with accent tips (symmetric)
    [_,_,o,_,_,o,_,_,_,_],   # join head
]

ANTENNA_ALERT = [
    [_,a,o,_,_,o,a,_,_,_],   # tips with accent glow
    [_,_,o,a,a,o,_,_,_,_],   # accent on inner stems
    [_,_,o,_,_,o,_,_,_,_],   # straight stems
    [_,_,o,_,_,o,_,_,_,_],   # straight stems
    [_,_,o,_,_,o,_,_,_,_],   # join head
]

ANTENNA_CURL = [
    [_,o,a,_,_,a,o,_,_,_],   # tips curl inward with accent
    [o,_,_,_,_,_,_,o,_,_],   # stems curve outward
    [_,o,_,_,_,_,o,_,_,_],   # curve back in
    [_,o,_,_,_,_,o,_,_,_],   # stems
    [_,_,o,_,_,o,_,_,_,_],   # join head
]

ANTENNA_BOUNCE = [
    [o,_,_,_,_,_,_,o,_,_],   # tips at normal width
    [o,a,_,_,_,_,a,o,_,_],   # accent
    [_,o,_,_,_,_,o,_,_,_],   # stems
    [_,_,o,_,_,o,_,_,_,_],   # converging
    [_,_,_,o,o,_,_,_,_,_],   # tight join at base (springy)
]

# ============================================================
# HANDS (3 rows x 4 cols)
# Left hand anchor: (17, 5), Right hand anchor: (17, 21)
# 4th col covers row 18's extra pink pixel outside old 3-col zone
# None = "don't change this pixel" (preserves base grid)
# ============================================================

HAND_LEFT_NORMAL = [
    [o, p, p, None],
    [o, p, p, None],
    [_, o, p, None],
]

HAND_RIGHT_NORMAL = [
    [None, p, p, o],
    [None, p, p, o],
    [None, p, o, _],
]

# Body fill: shows body outline where hand was (not transparent)
HAND_LEFT_UP = [
    [_, o, cr, cr],   # row 17: outline at col 6, cream at 7-8
    [_, _, o,  cr],   # row 18: outline at col 7, cream at 8 (fixes pink)
    [_, _, o,  cr],   # row 19: outline at col 7, cream at 8
]

HAND_RIGHT_UP = [
    [cr, cr, o, _],   # row 17: cream 21-22, outline at 23
    [cr, o,  _, _],   # row 18: cream 21, outline at 22
    [cr, o,  _, _],   # row 19: cream 21, outline at 22
]



# ============================================================
# BLUSH (1 row x 2 cols)
# ============================================================

BLUSH_NORMAL = [[b, b]]
BLUSH_HIDDEN = [[cr, cr]]
BLUSH_BRIGHT = [[a, a]]  # brighter blush for love/excited

# ============================================================
# RAISED HAND PIXEL OVERRIDES (whole-shift, no zone needed)
# All 3 rows (17-19) shift together to preserve elliptical hand shape
# Vacated positions filled with cream (body fill)
# ============================================================

# Level 1: all 3 rows shift 1 col outward
RAISED_HAND_LEFT = [
    (17, 4, 'outline_c'), (17, 5, 'pink'), (17, 7, 'cream'),
    (18, 4, 'outline_c'), (18, 5, 'pink'), (18, 8, 'cream'),
    (19, 5, 'outline_c'), (19, 6, 'pink'), (19, 7, 'cream'),
]
RAISED_HAND_RIGHT = [
    (17, 22, 'cream'), (17, 24, 'pink'), (17, 25, 'outline_c'),
    (18, 21, 'cream'), (18, 24, 'pink'), (18, 25, 'outline_c'),
    (19, 22, 'cream'), (19, 23, 'pink'), (19, 24, 'outline_c'),
]


# ============================================================
# OVERLAY ELEMENTS (absolute pixel positions)
# These are lists of (row, col, color) tuples
# ============================================================

# Small heart (placed in margin area)
OVERLAY_HEART_RIGHT = [
    (4, 25, 'heart'), (4, 27, 'heart'),
    (5, 24, 'heart'), (5, 25, 'heart'), (5, 26, 'heart'), (5, 27, 'heart'), (5, 28, 'heart'),
    (6, 25, 'heart'), (6, 26, 'heart'), (6, 27, 'heart'),
    (7, 26, 'heart'),
]

OVERLAY_HEART_LEFT = [
    (4, 2, 'heart'), (4, 4, 'heart'),
    (5, 1, 'heart'), (5, 2, 'heart'), (5, 3, 'heart'), (5, 4, 'heart'), (5, 5, 'heart'),
    (6, 2, 'heart'), (6, 3, 'heart'), (6, 4, 'heart'),
    (7, 3, 'heart'),
]

# ZZZ (for sleeping)
OVERLAY_ZZZ_1 = [
    (2, 24, 'zzz'), (2, 25, 'zzz'), (2, 26, 'zzz'),
    (3, 25, 'zzz'),
    (4, 24, 'zzz'), (4, 25, 'zzz'), (4, 26, 'zzz'),
]

OVERLAY_ZZZ_2 = [
    (1, 26, 'zzz'), (1, 27, 'zzz'),
    (2, 27, 'zzz'),
    (3, 26, 'zzz'), (3, 27, 'zzz'),
    (4, 24, 'zzz'), (4, 25, 'zzz'),
    (5, 25, 'zzz'),
    (6, 24, 'zzz'), (6, 25, 'zzz'),
]

# Question mark
OVERLAY_QUESTION = [
    (1, 25, 'question'), (1, 26, 'question'), (1, 27, 'question'),
    (2, 27, 'question'),
    (3, 25, 'question'), (3, 26, 'question'), (3, 27, 'question'),
    (4, 25, 'question'),
    (6, 25, 'question'),
]

# Sparkle dots
OVERLAY_SPARKLE_1 = [
    (3, 25, 'sparkle'),
    (5, 27, 'sparkle'),
    (2, 4, 'sparkle'),
]

OVERLAY_SPARKLE_2 = [
    (2, 26, 'sparkle'),
    (4, 28, 'sparkle'),
    (3, 3, 'sparkle'),
]

# Sweat drop
OVERLAY_SWEAT = [
    (6, 26, 'sweat'),
    (7, 26, 'sweat'),
    (8, 26, 'sweat'),
]

# Musical note (for voice)
OVERLAY_NOTE_1 = [
    (3, 26, 'accent'),
    (4, 26, 'accent'), (4, 27, 'accent'),
    (5, 26, 'accent'),
    (5, 25, 'accent'), (6, 25, 'accent'),
]

OVERLAY_NOTE_2 = [
    (2, 27, 'accent'),
    (3, 27, 'accent'), (3, 28, 'accent'),
    (4, 27, 'accent'),
    (4, 26, 'accent'), (5, 26, 'accent'),
]

# Exclamation mark (for notify/alert)
OVERLAY_EXCLAMATION = [
    (1, 26, 'accent'),
    (2, 26, 'accent'),
    (3, 26, 'accent'),
    (5, 26, 'accent'),
]

# D-2c: New overlay elements

# Tear drops (below both eyes, on face)
OVERLAY_TEAR = [
    (14, 10, 'sweat'),
    (15, 10, 'sweat'),
    (16, 10, 'sweat'),
    (14, 19, 'sweat'),
    (15, 19, 'sweat'),
    (16, 19, 'sweat'),
]

# Ellipsis "..." (right margin)
OVERLAY_ELLIPSIS = [
    (5, 25, 'outline_c'),
    (5, 27, 'outline_c'),
    (5, 29, 'outline_c'),
]

# Small single z (right margin, smaller than ZZZ)
OVERLAY_SMALL_Z = [
    (3, 25, 'zzz'), (3, 26, 'zzz'),
    (4, 26, 'zzz'),
    (5, 25, 'zzz'), (5, 26, 'zzz'),
]

# Starburst flash (cross pattern, right margin)
OVERLAY_STARBURST = [
    (2, 26, 'starburst'),
    (3, 25, 'starburst'), (3, 26, 'starburst'), (3, 27, 'starburst'),
    (4, 26, 'starburst'),
]

# Lightbulb with bright point (right margin)
OVERLAY_LIGHTBULB = [
    (2, 26, 'lightbulb'),
    (3, 25, 'lightbulb'), (3, 27, 'lightbulb'),
    (4, 25, 'outline_c'), (4, 27, 'outline_c'),
    (5, 26, 'outline_c'),
]

# Warm wave "~" (right margin)
OVERLAY_WARM = [
    (3, 25, 'accent'),
    (4, 26, 'accent'),
    (3, 27, 'accent'),
]

# X mark for error (3x3 diagonal cross, red)
OVERLAY_X_MARK = [
    (5, 25, 'x_mark'), (5, 27, 'x_mark'),
    (6, 26, 'x_mark'),
    (7, 25, 'x_mark'), (7, 27, 'x_mark'),
]

# Radiating lines for excited (bright pink, ↗↖ outward-upward, gradual appearance)
# Short lines (2px each side, appear first at F1)
OVERLAY_RAY_SHORT = [
    (5, 27, 'ray'), (6, 26, 'ray'),                     # right ↗
    (5, 2, 'ray'),  (6, 3, 'ray'),                      # left ↖ (mirror)
]
# Short + long lines (full 10px, appear at F3)
OVERLAY_RAY_FULL = [
    (5, 27, 'ray'), (6, 26, 'ray'),                     # right short ↗
    (7, 28, 'ray'), (8, 27, 'ray'), (9, 26, 'ray'),     # right long ↗ (below)
    (5, 2, 'ray'),  (6, 3, 'ray'),                      # left short ↖
    (7, 1, 'ray'),  (8, 2, 'ray'),  (9, 3, 'ray'),      # left long ↖ (below)
]

# Rising bubbles for recall (light blue, sequential appearance 1→2→3)
OVERLAY_BUBBLE_1 = [
    (7, 25, 'bubble'),   # 1 dot: lowest only
]
OVERLAY_BUBBLE_2 = [
    (7, 25, 'bubble'),   # 2 dots: lowest
    (5, 26, 'bubble'),   # + middle
]
OVERLAY_BUBBLE_3 = [
    (7, 25, 'bubble'),   # 3 dots: all
    (5, 26, 'bubble'),
    (3, 27, 'bubble'),
]

# Dizzy stars orbiting head (for drag, two variants for rotation effect)
OVERLAY_DIZZY_1 = [
    (2, 24, 'sparkle'),    # top-left
    (3, 28, 'sparkle'),    # top-right
    (5, 26, 'sparkle'),    # bottom-center
]
OVERLAY_DIZZY_2 = [
    (2, 27, 'sparkle'),    # top-right
    (5, 24, 'sparkle'),    # bottom-left
    (4, 28, 'sparkle'),    # right
]
