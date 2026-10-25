/* Short dialogues about leisure. Gaps: {answer|infinitive|tense}, tense pr / pc / fp. */
const DIALOGUES = [
  {
    id: 'demo', title: 'Ce week-end', titleBg: 'Този уикенд', tenses: ['pr', 'fp'],
    a: { name: 'Léa', gender: 'f' }, b: { name: 'Marc', gender: 'm' },
    lines: [
      { who: 'A', fr: "Salut Marc ! Qu'est-ce que tu {fais|faire|pr} ce week-end ?", bg: 'Здрасти, Марк! Какво правиш този уикенд?' },
      { who: 'B', fr: 'Samedi, je {vais jouer|jouer|fp} au tennis.', bg: 'В събота ще играя тенис.' },
      { who: 'A', fr: 'Et dimanche ?', bg: 'А в неделя?' },
      { who: 'B', fr: 'Dimanche, nous {allons voir|voir|fp} un film. Tu {viens|venir|pr} ?', bg: 'В неделя ще гледаме филм. Идваш ли?' },
      { who: 'A', fr: "Oui, avec plaisir ! J'{adore|adorer|pr} le cinéma.", bg: 'Да, с удоволствие! Обожавам киното.' }
    ]
  }
];
