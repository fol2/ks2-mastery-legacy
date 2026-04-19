// CollectionScreen — the Pokédex-style collection page.
// Top-level route: 'collection'. Shows all monsters across subjects with catch/level/stage/progress.

function CollectionScreen({ profile, onBack }) {
  const pid = profile?.id || 'default';
  const [selected, setSelected] = React.useState(null);

  // Flatten all monsters across subjects
  const allMonsterIds = SUBJECT_ORDER.flatMap(sid => MONSTERS_BY_SUBJECT[sid] || []);
  const totalCount = allMonsterIds.length;
  const caughtCount = allMonsterIds.filter(id =>
    MonsterEngine.getMonsterProgress(pid, id).caught
  ).length;

  return (
    <div style={{ padding: '32px 28px 48px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <Btn variant="ghost" icon="back" onClick={onBack} size="sm">Back to dashboard</Btn>
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 20, marginBottom: 28, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: TOKENS.muted, marginBottom: 6,
          }}>Your collection</div>
          <h1 style={{
            margin: 0, fontFamily: TOKENS.fontSerif, fontWeight: 800,
            fontSize: 42, letterSpacing: '-0.025em', color: TOKENS.ink, lineHeight: 1.05,
          }}>Monster Codex</h1>
          <p style={{
            margin: '10px 0 0', color: TOKENS.ink2, fontSize: 15.5, maxWidth: 560, lineHeight: 1.5,
          }}>
            Master words and skills to catch new friends. Every 10 words levels them up, and reaching
            50 / 80 / 100 mastered evolves them — all the way to <strong>Mega Form</strong>.
          </p>
        </div>
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          background: TOKENS.panel, border: `1px solid ${TOKENS.line}`,
          padding: '14px 20px', borderRadius: TOKENS.radius,
          boxShadow: TOKENS.shadow,
        }}>
          <div>
            <div style={{ fontSize: 12, color: TOKENS.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Caught</div>
            <div style={{ fontFamily: TOKENS.fontSerif, fontSize: 28, fontWeight: 800, color: TOKENS.ink }}>
              {caughtCount} <span style={{ color: TOKENS.muted, fontWeight: 500 }}>/ {totalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sections by subject */}
      {SUBJECT_ORDER.map(sid => {
        const subject = SUBJECTS[sid];
        const monsterIds = MONSTERS_BY_SUBJECT[sid] || [];
        const comingSoon = monsterIds.length === 0;
        return (
          <section key={sid} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            }}>
              <SubjectGlyph subject={subject} size={34} filled />
              <h2 style={{
                margin: 0, fontFamily: TOKENS.fontSerif, fontSize: 22, fontWeight: 700,
                color: TOKENS.ink, letterSpacing: '-0.01em',
              }}>{subject.name}</h2>
              {comingSoon && (
                <Chip tone="neutral">Coming soon</Chip>
              )}
            </div>
            {comingSoon ? (
              <div style={{
                padding: '28px 24px', background: TOKENS.panel,
                border: `1.5px dashed ${TOKENS.line}`, borderRadius: TOKENS.radius,
                color: TOKENS.muted, fontSize: 14, textAlign: 'center',
              }}>
                Monsters for {subject.name} arrive soon. For now, keep practising to unlock them.
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
              }}>
                {monsterIds.map(mid => {
                  const monster = MONSTERS[mid];
                  const prog = MonsterEngine.getMonsterProgress(pid, mid);
                  return (
                    <MonsterCard key={mid} monster={monster} progress={prog}
                      onOpen={() => setSelected({ monster, progress: prog })} />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {selected && (
        <MonsterDetailDialog
          monster={selected.monster}
          progress={selected.progress}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// --- Card for a monster in the codex ---
function MonsterCard({ monster, progress, onOpen }) {
  const { mastered, stage, level, caught } = progress;
  const stageLabel = MONSTER_STAGES[stage].label;
  const pct = Math.min(100, mastered);

  return (
    <button onClick={onOpen} style={{
      textAlign: 'left', padding: 0, border: 'none', cursor: 'pointer',
      background: TOKENS.panel, borderRadius: TOKENS.radius,
      outline: `1px solid ${caught ? monster.secondary : TOKENS.line}`,
      boxShadow: TOKENS.shadow, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.15s, box-shadow 0.15s',
      fontFamily: TOKENS.fontSans,
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Art panel */}
      <div style={{
        background: caught ? monster.pale : TOKENS.panelSoft,
        padding: '16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', minHeight: 148,
      }}>
        {caught ? (
          <MonsterArt monster={monster} stage={stage} size={128} />
        ) : (
          <>
            <MonsterArt monster={monster} stage={0} size={128} silhouette />
            <div style={{
              position: 'absolute', bottom: 8, right: 10,
              fontSize: 11, color: TOKENS.muted, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>??? · not yet caught</div>
          </>
        )}
        {caught && stage === 4 && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            padding: '3px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
            background: monster.primary, color: '#fff', letterSpacing: '0.08em',
          }}>★ MEGA</div>
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4,
        }}>
          <h3 style={{
            margin: 0, fontFamily: TOKENS.fontSerif, fontSize: 18, fontWeight: 700,
            color: caught ? TOKENS.ink : TOKENS.muted, letterSpacing: '-0.01em',
          }}>{caught ? monster.nameByStage[stage] : '???'}</h3>
          {caught && (
            <span style={{
              fontSize: 12, color: monster.primary, fontWeight: 800,
            }}>Lv {level}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: TOKENS.muted, marginBottom: 10 }}>
          {monster.subtitle} · {caught ? stageLabel : 'Locked'}
        </div>
        <ProgressBar value={pct} accent={monster.primary} height={6} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 6,
          fontSize: 11.5, color: TOKENS.muted, fontWeight: 600,
        }}>
          <span>{mastered}/100 mastered</span>
          <span>
            {stage < 4
              ? `Next: ${MONSTER_STAGES[stage+1].label} at ${MONSTER_STAGES[stage+1].threshold}`
              : 'Max form'}
          </span>
        </div>
      </div>
    </button>
  );
}

// --- Detail dialog for a monster ---
function MonsterDetailDialog({ monster, progress, onClose }) {
  const { mastered, stage, level, caught } = progress;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(29,43,58,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2500, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: TOKENS.panel, borderRadius: TOKENS.radiusLg,
        boxShadow: TOKENS.shadowLg, width: '100%', maxWidth: 640,
        overflow: 'hidden', fontFamily: TOKENS.fontSans,
      }}>
        {/* Hero */}
        <div style={{
          background: monster.pale, padding: '24px 28px 16px',
          display: 'flex', gap: 20, alignItems: 'center',
          borderBottom: `1px solid ${TOKENS.line}`,
        }}>
          <div>
            {caught ? (
              <MonsterArt monster={monster} stage={stage} size={140} />
            ) : (
              <MonsterArt monster={monster} stage={0} size={140} silhouette />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: monster.primary, marginBottom: 4,
            }}>{monster.subtitle}</div>
            <h2 style={{
              margin: 0, fontFamily: TOKENS.fontSerif, fontSize: 26, fontWeight: 800,
              color: TOKENS.ink, letterSpacing: '-0.02em',
            }}>{caught ? monster.nameByStage[stage] : '???'}</h2>
            <div style={{
              marginTop: 6, color: TOKENS.ink2, fontSize: 14,
            }}>
              {caught
                ? `${MONSTER_STAGES[stage].label} form · Level ${level}`
                : `Master 10 words from this pool to discover this friend.`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: TOKENS.muted, padding: 6,
          }}><Icon name="close" size={20} /></button>
        </div>

        {/* Progress meter */}
        <div style={{ padding: '20px 28px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 8,
            fontSize: 13, color: TOKENS.ink2, fontWeight: 600,
          }}>
            <span>Mastery progress</span>
            <span style={{ color: monster.primary, fontWeight: 800 }}>
              {mastered} / 100 words
            </span>
          </div>
          <ProgressBar value={mastered} accent={monster.primary} height={10} />

          {/* Evolution timeline */}
          <div style={{
            marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
          }}>
            {MONSTER_STAGES.map((s, i) => {
              const unlocked = stage >= i;
              return (
                <div key={i} style={{
                  textAlign: 'center', opacity: unlocked ? 1 : 0.4,
                }}>
                  <div style={{
                    background: unlocked ? monster.pale : TOKENS.panelSoft,
                    border: `1.5px solid ${unlocked ? monster.secondary : TOKENS.line}`,
                    borderRadius: 14, padding: '6px', marginBottom: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 70,
                  }}>
                    {unlocked ? (
                      <MonsterArt monster={monster} stage={i} size={58} />
                    ) : (
                      <MonsterArt monster={monster} stage={i} size={58} silhouette />
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: unlocked ? TOKENS.ink : TOKENS.muted,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{s.label}</div>
                  <div style={{ fontSize: 10.5, color: TOKENS.muted, marginTop: 2 }}>
                    {s.threshold === 0 ? '0' : s.threshold}+ words
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 22, padding: '14px 16px', background: TOKENS.panelSoft,
            border: `1px solid ${TOKENS.line}`, borderRadius: 12,
            fontSize: 13, color: TOKENS.ink2, lineHeight: 1.55,
          }}>
            <strong style={{ color: TOKENS.ink }}>How to grow {monster.name}:</strong>{' '}
            Practise the <strong>{monster.subtitle}</strong> in Spelling.
            A word is mastered when you spell it correctly enough times for the engine to
            mark it secure. Every mastered word feeds into this monster.
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact chip used on Spelling header & dashboard to show active monster for a subject
function MonsterChip({ monster, progress, onClick }) {
  const { mastered, stage, level, caught } = progress;
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 14px 5px 6px', borderRadius: 999,
      background: caught ? monster.pale : TOKENS.panelSoft,
      border: `1.5px solid ${caught ? monster.secondary : TOKENS.line}`,
      cursor: 'pointer', fontFamily: TOKENS.fontSans,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${caught ? monster.secondary : TOKENS.line}`,
      }}>
        {caught
          ? <MonsterArt monster={monster} stage={stage} size={30} />
          : <MonsterArt monster={monster} stage={0} size={30} silhouette />
        }
      </div>
      <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
        <div style={{
          fontFamily: TOKENS.fontSerif, fontSize: 13, fontWeight: 700,
          color: caught ? TOKENS.ink : TOKENS.muted,
        }}>
          {caught ? monster.nameByStage[stage] : 'Unseen monster'}
        </div>
        <div style={{ fontSize: 11, color: TOKENS.muted, fontWeight: 600 }}>
          {caught ? `Lv ${level} · ${mastered}/100` : `${mastered}/10 to catch`}
        </div>
      </div>
    </button>
  );
}

Object.assign(window, {
  CollectionScreen, MonsterCard, MonsterDetailDialog, MonsterChip,
});
