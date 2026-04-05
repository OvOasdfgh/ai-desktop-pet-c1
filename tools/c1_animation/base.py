"""C1 base grid, palette, and zone map."""

# Color palette
PALETTE = {
    '.':           None,
    'pink':        (255, 200, 200),
    'pink_light':  (255, 225, 220),
    'pink_dark':   (230, 170, 170),
    'cream':       (255, 243, 230),
    'cream_dark':  (240, 220, 200),
    'white':       (255, 255, 255),
    'eye':         (60, 50, 60),
    'eye_shine':   (255, 255, 255),
    'blush':       (255, 170, 170),
    'mouth':       (200, 130, 130),
    'outline_c':   (180, 160, 170),
    'accent':      (255, 180, 180),
    'inner':       (255, 235, 230),
    # Extra colors for overlays
    'heart':       (255, 150, 160),
    'zzz':         (180, 170, 190),
    'sparkle':     (255, 230, 200),
    'question':    (180, 160, 170),
    'sweat':       (200, 220, 240),
    # D-2c new overlay colors
    'lightbulb':   (255, 240, 150),
    'starburst':   (255, 220, 100),
    # D-4 batch 3 new overlay colors
    'x_mark':      (220, 80, 80),
    'ray':         (255, 120, 160),
    'bubble':      (150, 200, 230),
}

_ = '.'
o = 'outline_c'
p = 'pink'
l = 'pink_light'
d = 'pink_dark'
e = 'eye'
s = 'eye_shine'
b = 'blush'
m = 'mouth'
cr = 'cream'
a = 'accent'
i = 'inner'

# C1 base grid (32x32) - THE canonical source, do not modify
BASE_GRID = [
    [_]*32,                                                                                    # 0
    [_]*32,                                                                                    # 1
    [_,_,_,_,_,_,_,_,_,_,_,o,_,_,_,_,_,_,o,_,_,_,_,_,_,_,_,_,_,_,_,_],                      # 2
    [_,_,_,_,_,_,_,_,_,_,_,o,a,_,_,_,_,a,o,_,_,_,_,_,_,_,_,_,_,_,_,_],                      # 3
    [_,_,_,_,_,_,_,_,_,_,_,_,o,_,_,_,_,o,_,_,_,_,_,_,_,_,_,_,_,_,_,_],                      # 4
    [_,_,_,_,_,_,_,_,_,_,_,_,o,_,_,_,_,o,_,_,_,_,_,_,_,_,_,_,_,_,_,_],                      # 5
    [_,_,_,_,_,_,_,_,_,_,_,_,_,o,_,_,o,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],                      # 6
    [_,_,_,_,_,_,_,_,_,_,o,o,o,o,o,o,o,o,o,o,_,_,_,_,_,_,_,_,_,_,_,_],                      # 7
    [_,_,_,_,_,_,_,_,_,o,l,l,l,l,cr,cr,l,l,l,l,o,_,_,_,_,_,_,_,_,_,_,_],                    # 8
    [_,_,_,_,_,_,_,_,o,l,l,l,cr,cr,cr,cr,cr,cr,l,l,l,o,_,_,_,_,_,_,_,_,_],                   # 9
    [_,_,_,_,_,_,_,o,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,o,_,_,_,_,_,_,_,_,_],         # 10
    [_,_,_,_,_,_,_,o,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,o,_,_,_,_,_,_,_,_,_],         # 11
    [_,_,_,_,_,_,o,cr,cr,cr,e,e,cr,cr,cr,cr,cr,cr,e,e,cr,cr,cr,o,_,_,_,_,_,_,_,_],           # 12
    [_,_,_,_,_,_,o,cr,cr,cr,e,s,cr,cr,cr,cr,cr,cr,e,s,cr,cr,cr,o,_,_,_,_,_,_,_,_],           # 13
    [_,_,_,_,_,_,o,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,o,_,_,_,_,_,_,_,_],       # 14
    [_,_,_,_,_,_,o,cr,b,b,cr,cr,cr,cr,m,m,cr,cr,cr,cr,b,b,cr,o,_,_,_,_,_,_,_,_],             # 15
    [_,_,_,_,_,_,o,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,o,_,_,_,_,_,_,_,_],       # 16
    [_,_,_,_,_,o,p,p,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,p,p,o,_,_,_,_,_,_,_],         # 17
    [_,_,_,_,_,o,p,p,p,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,p,p,p,o,_,_,_,_,_,_,_],           # 18
    [_,_,_,_,_,_,o,p,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,p,o,_,_,_,_,_,_,_,_],         # 19
    [_,_,_,_,_,_,_,o,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,cr,o,_,_,_,_,_,_,_,_,_],         # 20
    [_,_,_,_,_,_,_,_,o,p,p,cr,cr,cr,cr,cr,cr,cr,cr,p,p,o,_,_,_,_,_,_,_,_,_,_],               # 21
    [_,_,_,_,_,_,_,_,o,d,d,o,o,o,o,o,o,o,o,d,d,o,_,_,_,_,_,_,_,_,_,_],                      # 22
    [_,_,_,_,_,_,_,_,_,o,o,_,_,_,_,_,_,_,_,o,o,_,_,_,_,_,_,_,_,_,_,_],                      # 23
    [_]*32,                                                                                    # 24
    [_]*32,                                                                                    # 25
    [_]*32,                                                                                    # 26
    [_]*32,                                                                                    # 27
    [_]*32,                                                                                    # 28
    [_]*32,                                                                                    # 29
    [_]*32,                                                                                    # 30
    [_]*32,                                                                                    # 31
]

# Zone map: (start_row, start_col) anchors for each modifiable zone
# Each zone override is a 2D sub-grid that gets stamped at these coordinates
ZONE_MAP = {
    'antenna':      (2, 11),   # rows 2-6, cols 11-20 (full antenna area, 5 rows x 10 cols)
    'energy_band':  (8, 9),    # rows 8-9, cols 9-21 (2 rows x 13 cols)
    'eye_left':     (12, 10),  # rows 12-13, cols 10-11 (2 rows x 2 cols)
    'eye_right':    (12, 18),  # rows 12-13, cols 18-19 (2 rows x 2 cols)
    'mouth':        (15, 13),  # row 15, cols 13-16 (1 row x 4 cols)
    'blush_left':   (15, 8),   # row 15, cols 8-9 (1 row x 2 cols)
    'blush_right':  (15, 20),  # row 15, cols 20-21 (1 row x 2 cols)
    'hand_left':    (17, 5),   # rows 17-19, cols 5-8 (3 rows x 4 cols)
    'hand_right':   (17, 21),  # rows 17-19, cols 21-24 (3 rows x 4 cols)
    'feet':         (21, 8),   # rows 21-23, cols 8-21 (3 rows x 14 cols)
}

SIZE = 32
CANVAS_HEIGHT = 40  # frame canvas height (SIZE + padding for bounce)
PADDING_TOP = 4     # rows of transparent padding above character
SCALE = 8
