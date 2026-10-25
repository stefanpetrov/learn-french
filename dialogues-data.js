/* Short dialogues about leisure, written and checked by native-level reviewers.
   Gaps in the French: {answer|infinitive|tense}, tense pr / pc / fp.
   a / b: the two speakers (gender f / m, used for the voice and for agreement). */
const DIALOGUES = [
  {
    id: "weekend", title: "Ce week-end", titleBg: "Този уикенд", tenses: ["fp", "pr"],
    a: { name: "Léa", gender: "f" }, b: { name: "Marc", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Marc ! Qu'est-ce que tu {fais|faire|pr} ce week-end ?", bg: "Здрасти, Марк! Какво правиш този уикенд?" },
      { who: "B", fr: "Samedi matin, je {vais jouer|jouer|fp} au tennis avec mon frère.", bg: "В събота сутрин ще играя тенис с брат си." },
      { who: "A", fr: "Super ! Et samedi soir ?", bg: "Супер! А в събота вечер?" },
      { who: "B", fr: "Je suis libre. Et toi, tu {sors|sortir|pr} ?", bg: "Свободен съм. А ти излизаш ли?" },
      { who: "A", fr: "Oui ! Julie et moi, nous {allons danser|danser|fp} en ville. Ça te dit ?", bg: "Да! С Жули ще ходим да танцуваме в центъра. Навит ли си?" },
      { who: "B", fr: "Avec plaisir ! Et dimanche ?", bg: "С удоволствие! А в неделя?" },
      { who: "A", fr: "Dimanche, je {vais dormir|dormir|fp} jusqu'à midi !", bg: "В неделя ще спя до обяд!" },
      { who: "B", fr: "Et moi, je {vais regarder|regarder|fp} un match de foot à la télé.", bg: "А аз ще гледам футболен мач по телевизията." }
    ]
  },
  {
    id: "cinema", title: "Au cinéma ?", titleBg: "На кино?", tenses: ["pr", "fp"],
    a: { name: "Léa", gender: "f" }, b: { name: "Marc", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Marc ! Vendredi soir, je {vais voir|voir|fp} un film au cinéma. Tu viens ?", bg: "Здрасти, Марк! В петък вечер ще гледам един филм на кино. Идваш ли?" },
      { who: "B", fr: "Oh, super ! C'est quel film ?", bg: "О, супер! Какъв филм?" },
      { who: "A", fr: "Une comédie française. Tu {aimes|aimer|pr} les comédies ?", bg: "Френска комедия. Харесваш ли комедии?" },
      { who: "B", fr: "Oui, j'{adore|adorer|pr} ça ! La séance est à quelle heure ?", bg: "Да, обожавам ги! В колко часа е прожекцията?" },
      { who: "A", fr: "À huit heures, au cinéma Rex. Tu {vas prendre|prendre|fp} le bus ?", bg: "В осем, в кино „Рекс“. С автобус ли ще дойдеш?" },
      { who: "B", fr: "Oui, le 5. On se retrouve à l'arrêt, devant la poste ?", bg: "Да, с петицата. Да се срещнем на спирката пред пощата?" },
      { who: "A", fr: "D'accord ! Je {vais être|être|fp} à l'arrêt à sept heures et demie.", bg: "Добре! Ще съм на спирката в седем и половина." },
      { who: "B", fr: "Parfait ! Et après le film, nous {allons faire|faire|fp} un tour en ville ?", bg: "Чудесно! А след филма ще се поразходим ли из града?" },
      { who: "A", fr: "Bonne idée ! À vendredi !", bg: "Добра идея! До петък!" }
    ]
  },
  {
    id: "rdv", title: "Rendez-vous", titleBg: "Среща", tenses: ["pr", "fp"],
    a: { name: "Léa", gender: "f" }, b: { name: "Marc", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Marc ! Tu {vas venir|venir|fp} au concert de jazz jeudi ?", bg: "Здрасти, Марк! Ще дойдеш ли на джаз концерта в четвъртък?" },
      { who: "B", fr: "Oui, bien sûr ! Ça commence à quelle heure ?", bg: "Да, разбира се! В колко започва?" },
      { who: "A", fr: "À neuf heures. Avant, nous {allons boire|boire|fp} un verre ?", bg: "В девет. Преди това ще пийнем ли по нещо?" },
      { who: "B", fr: "D'accord, mais je {sors|sortir|pr} du bureau à sept heures.", bg: "Добре, но излизам от офиса в седем." },
      { who: "A", fr: "Ça marche. Tu {connais|connaître|pr} le Café des Arts ?", bg: "Става. Знаеш ли кафенето „Café des Arts“?" },
      { who: "B", fr: "Oui, il {est|être|pr} juste à côté de la salle de concert.", bg: "Да, точно до концертната зала е." },
      { who: "A", fr: "Alors, rendez-vous là-bas à sept heures et demie ?", bg: "Тогава да се видим там в седем и половина?" },
      { who: "B", fr: "Super ! Je {vais prendre|prendre|fp} un taxi, c'est plus rapide.", bg: "Супер! Ще взема такси, по-бързо е." },
      { who: "A", fr: "Génial ! À jeudi !", bg: "Страхотно! До четвъртък!" }
    ]
  },
  {
    id: "weekend-dernier", title: "Le week-end dernier", titleBg: "Миналият уикенд", tenses: ["pc"],
    a: { name: "Chloé", gender: "f" }, b: { name: "Thomas", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Thomas ! Qu'est-ce que tu {as fait|faire|pc} le week-end dernier ?", bg: "Здрасти, Тома! Какво прави миналия уикенд?" },
      { who: "B", fr: "Samedi, je {suis allé|aller|pc} au match de foot avec mon frère.", bg: "В събота ходих на футболен мач с брат си." },
      { who: "A", fr: "Super ! Et dimanche, tu {es sorti|sortir|pc} ?", bg: "Супер! А в неделя излезе ли някъде?" },
      { who: "B", fr: "Non, j'{ai dormi|dormir|pc} jusqu'à midi ! Et toi ?", bg: "Не, спах до обяд! А ти?" },
      { who: "A", fr: "Moi, je {suis partie|partir|pc} à la montagne avec des amies.", bg: "Аз пък заминах на планина с приятелки." },
      { who: "B", fr: "Génial ! Et vous {êtes revenues|revenir|pc} quand ?", bg: "Страхотно! И кога се върнахте?" },
      { who: "A", fr: "Hier soir. C'était super, mais je suis très fatiguée !", bg: "Снощи. Беше супер, но съм много уморена!" },
      { who: "B", fr: "Moi aussi… et pourtant, j'ai beaucoup dormi !", bg: "И аз… а уж спах толкова много!" }
    ]
  },
  {
    id: "vacances-grece", title: "Les vacances", titleBg: "Почивката", tenses: ["pc", "pr"],
    a: { name: "Chloé", gender: "f" }, b: { name: "Thomas", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Thomas ! Alors, ces vacances en Grèce ?", bg: "Здрасти, Тома! Е, как мина почивката в Гърция?" },
      { who: "B", fr: "Super ! Ma copine et moi, nous {sommes partis|partir|pc} dix jours.", bg: "Супер! С приятелката ми заминахме за десет дни." },
      { who: "A", fr: "Trop bien ! Qu'est-ce que vous {avez vu|voir|pc} ?", bg: "Яко! Какво видяхте?" },
      { who: "B", fr: "Athènes, et puis une petite île. Nous {avons pris|prendre|pc} le bateau.", bg: "Атина, а после едно малко островче. Отидохме дотам с кораб." },
      { who: "A", fr: "Ça a l'air génial ! Il {fait|faire|pr} chaud là-bas en septembre ?", bg: "Звучи страхотно! Топло ли е там през септември?" },
      { who: "B", fr: "Oui, trente degrés ! Regarde, je suis encore tout bronzé.", bg: "Да, трийсет градуса! Виж, още съм почернял." },
      { who: "A", fr: "Et tu {as aimé|aimer|pc} la cuisine grecque ?", bg: "А хареса ли ти гръцката кухня?" },
      { who: "B", fr: "Oui, j'{adore|adorer|pr} la salade grecque ! Et toi, tu pars où en vacances ?", bg: "Да, обожавам гръцка салата! А ти къде ще ходиш на почивка?" },
      { who: "A", fr: "Moi, je {vais|aller|pr} en Italie le mois prochain !", bg: "Аз отивам в Италия следващия месец!" }
    ]
  },
  {
    id: "concert-hier", title: "Le concert", titleBg: "Концертът", tenses: ["pc", "pr"],
    a: { name: "Chloé", gender: "f" }, b: { name: "Thomas", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Thomas ! Alors, le concert d'hier soir, ça t'a plu ?", bg: "Здрасти, Тома! Е, хареса ли ти снощният концерт?" },
      { who: "B", fr: "J'{ai adoré|adorer|pc} ! La chanteuse a une voix incroyable.", bg: "Страшно ми хареса! Певицата има невероятен глас." },
      { who: "A", fr: "Oui, et elle {a chanté|chanter|pc} toutes mes chansons préférées !", bg: "Да, и изпя всичките ми любими песни!" },
      { who: "B", fr: "Et toi, tu {as dansé|danser|pc} pendant tout le concert !", bg: "А ти танцува през целия концерт!" },
      { who: "A", fr: "Bien sûr ! Et à la fin, nous {avons applaudi|applaudir|pc} pendant dix minutes !", bg: "Разбира се! А накрая ръкопляскахме десет минути!" },
      { who: "B", fr: "C'est vrai ! Tu {sais|savoir|pr} si elle revient l'année prochaine ?", bg: "Така е! Знаеш ли дали пак ще дойде догодина?" },
      { who: "A", fr: "Oui, en mai ! Je {prends|prendre|pr} deux billets ?", bg: "Да, през май! Да взема ли два билета?" },
      { who: "B", fr: "Avec plaisir ! J'adore ses concerts !", bg: "С удоволствие! Обожавам концертите ѝ!" }
    ]
  },
  {
    id: "sport", title: "Le sport", titleBg: "Спорт", tenses: ["pr"],
    a: { name: "Sophie", gender: "f" }, b: { name: "Julien", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Julien ! Tu {fais|faire|pr} du sport en ce moment ?", bg: "Здрасти, Жулиен! Спортуваш ли напоследък?" },
      { who: "B", fr: "Oui, je {joue|jouer|pr} au tennis deux fois par semaine.", bg: "Да, играя тенис два пъти седмично." },
      { who: "A", fr: "Super ! Moi, je {vais|aller|pr} à la piscine tous les mercredis.", bg: "Супер! Аз пък ходя на басейн всяка сряда." },
      { who: "B", fr: "Et le week-end, tu {fais|faire|pr} du vélo ?", bg: "А през уикенда караш ли колело?" },
      { who: "A", fr: "Non, je {préfère|préférer|pr} le yoga, c'est plus calme.", bg: "Не, предпочитам йога – по-спокойно е." },
      { who: "B", fr: "Le samedi, mes copains et moi, nous {jouons|jouer|pr} au foot.", bg: "Ние с приятелите ми всяка събота играем футбол." },
      { who: "A", fr: "Ça a l'air sympa ! C'est où ?", bg: "Звучи готино! Къде играете?" },
      { who: "B", fr: "Au parc, près de chez moi. Tu {viens|venir|pr} nous voir samedi ?", bg: "В парка, близо до вкъщи. Идваш ли да ни гледаш в събота?" },
      { who: "A", fr: "Avec plaisir ! À samedi !", bg: "С удоволствие! До събота!" }
    ]
  },
  {
    id: "loisirs", title: "Mes loisirs", titleBg: "Моите хобита", tenses: ["pr"],
    a: { name: "Sophie", gender: "f" }, b: { name: "Julien", gender: "m" },
    lines: [
      { who: "A", fr: "Julien, qu'est-ce que tu {aimes|aimer|pr} faire pendant ton temps libre ?", bg: "Жулиен, какво обичаш да правиш в свободното си време?" },
      { who: "B", fr: "J'{adore|adorer|pr} lire, surtout des romans policiers.", bg: "Обожавам да чета, особено криминални романи." },
      { who: "A", fr: "Moi aussi ! Mais le soir, je {regarde|regarder|pr} souvent des séries.", bg: "И аз! Но вечер често гледам сериали." },
      { who: "B", fr: "Ah non, pas moi ! Je {déteste|détester|pr} la télé.", bg: "Аз пък не! Мразя телевизията." },
      { who: "A", fr: "Et la musique ? Tu {écoutes|écouter|pr} quoi ?", bg: "А музика? Какво слушаш?" },
      { who: "B", fr: "Surtout du rock. Et je {joue|jouer|pr} un peu de la guitare.", bg: "Най-вече рок. И свиря малко на китара." },
      { who: "A", fr: "Cool ! Moi, je {préfère|préférer|pr} le jazz.", bg: "Яко! Аз пък предпочитам джаз." },
      { who: "B", fr: "Il y a un concert de jazz samedi. Ça te dit ?", bg: "В събота има джаз концерт. Навиваш ли се?" },
      { who: "A", fr: "Oui, avec plaisir !", bg: "Да, с удоволствие!" }
    ]
  },
  {
    id: "coursdanse", title: "Au cours de danse", titleBg: "На курса по танци", tenses: ["pr"],
    a: { name: "Marie", gender: "f" }, b: { name: "Stefan", gender: "m" },
    lines: [
      { who: "A", fr: "Salut ! Tu es nouveau ? Moi, je m'{appelle|s'appeler|pr} Marie.", bg: "Здрасти! Нов ли си? Аз се казвам Мари." },
      { who: "B", fr: "Oui ! Enchanté. Moi, c'est Stefan. Je {viens|venir|pr} de Bulgarie.", bg: "Да! Приятно ми е. Аз съм Стефан. От България съм." },
      { who: "A", fr: "Ah, super ! Et tu {habites|habiter|pr} près d'ici ?", bg: "А, супер! И наблизо ли живееш?" },
      { who: "B", fr: "Oui, dans le quartier. Tu {connais|connaître|pr} la prof ?", bg: "Да, тук, в квартала. Познаваш ли учителката?" },
      { who: "A", fr: "Oui, elle est très sympa. J'{apprends|apprendre|pr} la salsa avec elle depuis un an.", bg: "Да, много е готина. Уча салса при нея от година." },
      { who: "B", fr: "Moi, je {danse|danser|pr} très mal. Je suis un vrai débutant !", bg: "Аз пък танцувам много зле. Съвсем начинаещ съм!" },
      { who: "A", fr: "Ce n'est pas grave ! On danse ensemble ?", bg: "Няма страшно! Да танцуваме заедно?" },
      { who: "B", fr: "Avec plaisir !", bg: "С удоволствие!" }
    ]
  },
  {
    id: "livresfilms", title: "Livres et films", titleBg: "Книги и филми", tenses: ["pr", "pc"],
    a: { name: "Marie", gender: "f" }, b: { name: "Stefan", gender: "m" },
    lines: [
      { who: "A", fr: "Salut, Stefan ! Qu'est-ce que tu {lis|lire|pr} en ce moment ?", bg: "Здрасти, Стефане! Какво четеш в момента?" },
      { who: "B", fr: "Un roman policier. Il me plaît beaucoup !", bg: "Един криминален роман. Много ми харесва!" },
      { who: "A", fr: "En français ? Tu {comprends|comprendre|pr} tout ?", bg: "На френски ли? Всичко ли разбираш?" },
      { who: "B", fr: "Presque tout. Je {traduis|traduire|pr} les mots difficiles avec un dictionnaire.", bg: "Почти всичко. Трудните думи ги превеждам с речник." },
      { who: "A", fr: "Bravo ! Moi, hier soir, j'{ai vu|voir|pc} une comédie française au cinéma.", bg: "Браво! А аз снощи гледах една френска комедия на кино." },
      { who: "B", fr: "Ah oui ? Elle t'a plu ?", bg: "Така ли? Хареса ли ти?" },
      { who: "A", fr: "Oui, beaucoup ! Et j'{ai compris|comprendre|pc} toutes les blagues !", bg: "Да, много! И разбрах всички шеги!" },
      { who: "B", fr: "Super ! Moi, samedi dernier, j'{ai regardé|regarder|pc} un film français, mais avec des sous-titres.", bg: "Супер! А аз миналата събота гледах един френски филм, но със субтитри." },
      { who: "A", fr: "Alors, la prochaine fois, on va au cinéma ensemble ?", bg: "Тогава следващия път да отидем заедно на кино?" }
    ]
  }
];
