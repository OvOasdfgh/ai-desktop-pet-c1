# State registry
_STATES = {}

def register(group):
    """Decorator to register animation state functions."""
    def decorator(func):
        state = func()
        _STATES[state.name] = state
        state.group = group
        return func
    return decorator

def get_all_states():
    return dict(_STATES)

def get_states_by_group(group):
    return {k: v for k, v in _STATES.items() if getattr(v, 'group', '') == group}
