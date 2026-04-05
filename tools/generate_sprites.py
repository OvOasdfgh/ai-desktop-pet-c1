"""Entry point for generating all C1 animation sprites."""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from c1_animation.states import get_all_states, get_states_by_group
from c1_animation.frame_engine import render_state
from c1_animation.preview_generator import (
    generate_sprite_sheet,
    generate_individual_frames,
    generate_group_preview,
    generate_master_preview,
    generate_states_json,
)


def import_all_states():
    """Import all state modules to trigger registration."""
    from c1_animation.states import basic
    try:
        from c1_animation.states import conversation
    except ImportError:
        pass
    try:
        from c1_animation.states import memory
    except ImportError:
        pass
    try:
        from c1_animation.states import proactive
    except ImportError:
        pass
    try:
        from c1_animation.states import user_interaction
    except ImportError:
        pass
    try:
        from c1_animation.states import emotions
    except ImportError:
        pass
    try:
        from c1_animation.states import environment
    except ImportError:
        pass
    try:
        from c1_animation.states import movement
    except ImportError:
        pass
    try:
        from c1_animation.states import multimedia
    except ImportError:
        pass


def main():
    import_all_states()
    all_states = get_all_states()

    if '--list' in sys.argv:
        total_frames = 0
        for name, state in sorted(all_states.items()):
            loop_str = " (loop)" if state.loop else ""
            print(f"  {name:20s}  {len(state.frames)} frames  {state.fps}fps  {state.group}{loop_str}")
            total_frames += len(state.frames)
        print(f"\n  Total: {len(all_states)} states, {total_frames} frames")
        return

    target_state = None
    target_group = None
    preview_only = '--preview-only' in sys.argv

    for arg in sys.argv[1:]:
        if arg.startswith('--state='):
            target_state = arg.split('=', 1)[1]
        elif arg.startswith('--group='):
            target_group = arg.split('=', 1)[1]

    # Filter states
    if target_state:
        states_to_gen = {target_state: all_states[target_state]} if target_state in all_states else {}
    elif target_group:
        states_to_gen = get_states_by_group(target_group)
    else:
        states_to_gen = all_states

    if not states_to_gen:
        print("No states found.")
        return

    # Generate
    for name, state in states_to_gen.items():
        print(f"  Generating: {name} ({len(state.frames)} frames)")
        generate_sprite_sheet(state)
        if not preview_only:
            generate_individual_frames(state)

    # Group previews
    groups = set(s.group for s in states_to_gen.values() if s.group)
    for group in sorted(groups):
        group_states = {k: v for k, v in states_to_gen.items() if v.group == group}
        generate_group_preview(group_states, group)
        print(f"  Preview: preview_{group}.png")

    # Master preview if generating all
    if not target_state and not target_group:
        generate_master_preview(all_states)
        generate_states_json(all_states)
        print(f"  Master preview and states.json generated")

    print(f"\nDone! {len(states_to_gen)} states generated.")


if __name__ == '__main__':
    main()
