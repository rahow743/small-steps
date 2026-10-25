// Fictional psychological reflections. These stages describe her confidence,
// not time since injury, rehabilitation exercises, or clearance to fence.
const stages = [
  {
    movement: 'Return-to-fencing reflection',
    situation: 'Thinking about fencing after my ACL injury',
    notes: [
      'I missed the piste, but imagining my knee giving way again made even thinking about fencing feel frightening. I talked about that fear at my physiotherapy appointment.',
      'Hearing shoes on the fencing hall floor brought back the moment I hurt my knee. I named the memory instead of pretending I was ready to train.',
      'Watching my teammates fence made me feel both connected and left behind. Today I focused on being honest about how vulnerable my knee still felt.',
      'I worried that I would never trust my injured knee in a fencing stance again. Writing it down helped me explain that worry to my physiotherapist.',
    ],
    wins: ['I told my physiotherapist how afraid I was of reinjuring my ACL.', 'I stayed in touch with my fencing club even though I was not training.', 'I let myself miss fencing without treating today as a failure.', 'I wrote down one question about knee confidence for my next appointment.'],
  },
  {
    movement: 'En garde',
    situation: 'Reflecting on the en garde stance in my individual rehab plan',
    notes: [
      'During the en garde work my physiotherapist had agreed with me, I noticed how closely I was watching my injured knee. We made room to talk about that hesitation.',
      'The familiar fencing stance still felt unfamiliar in my recovering body. I was able to describe what felt worrying instead of hiding it from my physiotherapist.',
      'I visited the club without joining a bout. Seeing the piste stirred up nerves, but an unhurried conversation with my coach helped me feel included.',
      'I caught myself comparing my current stance with how fencing felt before the ACL injury. Today I gave more attention to what I noticed than to how I used to move.',
    ],
    wins: ['I spoke up when my en garde stance brought up knee worries.', 'I recognised a brief moment of feeling settled in a familiar fencing position.', 'I visited my fencing club and felt part of the team again.', 'I asked my coach to keep expectations in line with my individual rehab plan.'],
  },
  {
    movement: 'Advance and retreat',
    situation: 'Reflecting on advance-and-retreat footwork cleared by my physiotherapist',
    notes: [
      'In the advance-and-retreat work already agreed with my physiotherapist, changing from going forward to going backward brought up fear of another ACL injury.',
      'I noticed myself bracing before the footwork in my individual plan. Saying that out loud helped my coach understand why I wanted more time.',
      'A teammate asked how recovery was going. I could talk about feeling more familiar with fencing footwork without pretending that every day was easy.',
      'The sound of another fencer moving quickly beside the piste unsettled me. I returned my attention to my own session and what my physiotherapist had agreed with me.',
    ],
    wins: ['I described which part of advance-and-retreat footwork made me anxious.', 'I noticed a moment of trusting my knee during the footwork in my plan.', 'I kept my own pace instead of matching a teammate on the next piste.', 'I asked for a pause and felt comfortable saying why I needed it.'],
  },
  {
    movement: 'Lunge preparation',
    situation: 'Discussing confidence about a fencing lunge and the return to en garde',
    notes: [
      'Thinking about committing to a lunge still brought up the memory of my ACL injury. I discussed the push-off and return to en garde with my physiotherapist, without treating lower fear as permission to progress.',
      'I watched my coach demonstrate a lunge and noticed less dread than before. My own movement choices continued to follow the plan we had already agreed.',
      'The idea of recovering from a lunge felt more worrying than the attack itself. Naming that detail made my next conversation with my physiotherapist more useful.',
      'I was tempted to judge my recovery by how quickly other fencers were moving. I reminded myself that confidence and return-to-fencing decisions are separate conversations.',
    ],
    wins: ['I explained my fear about the return from a lunge to en garde.', 'I watched a lunge demonstration without immediately looking away.', 'I brought a specific fencing concern to my physiotherapist.', 'I noticed that thinking about fencing felt a little less overwhelming.'],
  },
  {
    movement: 'Return-to-fencing reflection',
    situation: 'Reflecting on knee trust and an individual return-to-fencing plan',
    notes: [
      'Fencing felt more like part of my identity again. I could picture being on the piste with less fear while continuing to leave return-to-training decisions with my care team.',
      'The footwork in my agreed plan felt more familiar today. I noticed that confidence can grow without needing to prove it in a bout.',
      'I spoke with my coach about what feeling supported on the piste looks like for me. I felt calmer about asking for time, space, and clear expectations.',
      'I recognised how much had changed in the way I talked about my injured knee. There was still uncertainty, alongside a quieter sense that I belonged in fencing.',
    ],
    wins: ['I could imagine fencing again without fear taking over the whole picture.', 'I recognised more trust in my knee during the movement already in my plan.', 'I talked to my coach about an individual return to the piste.', 'I appreciated my progress without setting myself a competition deadline.'],
  },
];

export function fencingStory(index, length, { rest = false, harder = false } = {}) {
  const stage = stages[Math.min(4, Math.floor(index / length * 5))];
  const pick = values => values[index % values.length];
  const note = rest
    ? 'A rest day from physical fencing practice. I missed moving on the piste, but gave myself permission to recover without testing my injured knee.'
    : pick(stage.notes);
  const setback = harder ? ' A sharp shoe squeak near the piste brought back the injury memory, and fear was stronger today. I talked it through rather than judging myself for the setback.' : '';
  return {
    movement: rest ? 'Not practised today' : stage.movement,
    fear_movement: rest ? 'Rest day: thinking about fencing after my ACL injury' : stage.situation,
    story: note + setback,
    win: `Sample: ${rest ? 'I respected a rest day without needing to prove my knee was ready for fencing.' : harder ? 'I told my coach that reinjury worries felt stronger today and asked for some space.' : pick(stage.wins)}`,
    support: `Sample: ${pick(['My physiotherapist listened to my worries about another ACL injury, and my coach respected the plan we had agreed.', 'A teammate checked in without asking when I would compete again. Being included in club life helped.', 'I named the exact fencing situation that felt frightening and gave myself permission to pause.', 'My coach reminded me that I could stay connected to fencing while following my individual rehab plan.'])}`,
    gratitude: `Sample: ${pick(['A fencing teammate who kept me included during my ACL recovery.', 'A physiotherapist who listened to the emotional side of returning to fencing.', 'My coach asking how I felt about the piste rather than asking for a return date.', 'The chance to feel like a fencer even on a rest day.'])}`,
    challenge: `Sample: ${harder ? 'Feeling scared near the piste again made me worry that my ACL recovery had gone backward.' : pick(['I worried that my injured knee would give way when I thought about fencing.', 'Watching teammates train made me feel I was falling behind as a fencer.', 'I felt frustrated that familiar fencing movements could still bring up reinjury fears.', 'I worried that asking for more time would disappoint my coach.'])}`,
    reframe: `Sample: ${pick(['Feeling afraid does not make me less of a fencer. I can describe the feeling and follow my own care plan.', 'A difficult day does not erase the confidence I have noticed over these months.', 'I can stay connected to my fencing team without comparing my recovery with anyone else.', 'Speaking honestly about my knee and my confidence helps the people supporting me understand what I need.'])}`,
  };
}
