/* "Защо е грешно": explain a wrong verb form with the rule behind it.
   CONTRACT (used by the Test in app.js and by when.js):
     explainMistake(q, given) -> { kind, text } | null
       q:     { inf, tense: 'pr'|'pc'|'fp', p?: 0..5, answer }   answer = the expected verb part
              as in the Test (may hold (e)/(s)); p is optional (found from answer when missing)
       given: what the learner typed
       kind:  'person' | 'tense' | 'aux' | 'agree' | 'infinitive' | 'fp-inf' | 'no-aux'
       text:  one short Bulgarian sentence (informal "ти"), plain text
     Returns null when no rule is certain: then nothing extra is shown. */
