# Event runtime and reward decoupling

## Why this exists

The learning engine decides outcomes first.
The reward layer reacts afterwards.

That means the important flow is:

```txt
subject service -> domain events -> platform event runtime -> subscribers -> reward / toast / event-log side effects
```

## Current domain events

### Emitted by the Spelling service

- `spelling.retry-cleared`
- `spelling.word-secured`
- `spelling.mastery-milestone`
- `spelling.session-completed`

### Derived by the platform runtime

- `platform.practice-streak-hit`

## Current reward reactions

The spelling reward subscriber listens for `spelling.word-secured` and updates the monster codex.
That can emit reward events such as:

- `reward.monster` with `kind = caught`
- `reward.monster` with `kind = evolve`
- `reward.monster` with `kind = levelup`
- `reward.monster` with `kind = mega`

Reward events can carry toast metadata for the shared overlay UI, but they do not mutate subject learning state.

## Runtime guarantees

- Subject services do not call reward systems directly.
- Subject modules do not translate their own mastery events into reward writes.
- Reward subscribers can be disabled without changing pedagogy or spelling outcomes.
- Subscriber failures are contained so learning can continue.
- The event log stores both domain events and reward reactions for auditability.

## Extension points

Future quest, badge, cosmetic or seasonal systems should subscribe here rather than touching subject engines.
That keeps new game systems additive instead of pedagogically entangling them.
