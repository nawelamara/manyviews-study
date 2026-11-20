// All texts of the online study in 5 languages. The translations (zh-Hant, fr, ar) were drafted with AI help
// and must be checked by a native speaker before the study opens. Painting titles and artist names stay in English.
'use strict';
const LANGS = [['en', 'English'], ['zh-Hant', '繁體中文'], ['fr', 'Français'], ['ar', 'العربية']];

const EMO = {
  en: {},
  'zh-Hant': { happiness: '快樂', surprise: '驚訝', anticipation: '期待', trust: '信任', humility: '謙卑', optimism: '樂觀', fear: '恐懼', sadness: '悲傷', love: '愛', disgust: '厭惡', gratitude: '感激', pessimism: '悲觀', arrogance: '傲慢', disagreeableness: '不友善', anger: '憤怒', agreeableness: '親切', regret: '後悔', shame: '羞恥', shyness: '害羞', none: '沒有特別的情緒' },
  fr: { happiness: 'joie', surprise: 'surprise', anticipation: 'anticipation', trust: 'confiance', humility: 'humilité', optimism: 'optimisme', fear: 'peur', sadness: 'tristesse', love: 'amour', disgust: 'dégoût', gratitude: 'gratitude', pessimism: 'pessimisme', arrogance: 'arrogance', disagreeableness: 'hostilité', anger: 'colère', agreeableness: 'amabilité', regret: 'regret', shame: 'honte', shyness: 'timidité', none: 'aucune émotion particulière' },
  ar: { happiness: 'سعادة', surprise: 'دهشة', anticipation: 'ترقّب', trust: 'ثقة', humility: 'تواضع', optimism: 'تفاؤل', fear: 'خوف', sadness: 'حزن', love: 'حب', disgust: 'اشمئزاز', gratitude: 'امتنان', pessimism: 'تشاؤم', arrogance: 'غطرسة', disagreeableness: 'نفور', anger: 'غضب', agreeableness: 'لطف', regret: 'ندم', shame: 'عار', shyness: 'خجل', none: 'لا شعور معيّن' },
};
const emo = (lang, f) => (lang === 'en' ? (f === 'none' ? 'no particular emotion' : f) : EMO[lang][f]);

// lists and counts per language
const FMT = {
  en: { list: (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]), cnt: (e, c, n) => `${e} (${c} of ${n})` },
  'zh-Hant': { list: (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join('、') + '和' + xs[xs.length - 1]), cnt: (e, c, n) => `${e}（${n} 人中 ${c} 人）` },
  fr: { list: (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' et ' + xs[xs.length - 1]), cnt: (e, c, n) => `${e} (${c} sur ${n})` },
  ar: { list: (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join('، ') + ' و' + xs[xs.length - 1]), cnt: (e, c, n) => `${e} (${c} من ${n})` },
};

// The three descriptions (A, B, C) and the model prediction, built from the painting's data.
const POSITIVE = ['gratitude', 'happiness', 'humility', 'love', 'optimism', 'trust'];
const NEGATIVE = ['anger', 'arrogance', 'disgust', 'fear', 'pessimism', 'regret', 'sadness', 'shame'];
function describe(lang, s, cond) {
  const E = (f) => emo(lang, f), F = FMT[lang], n = s.n;
  const cnts = (xs) => F.list(xs.map(([f, c]) => F.cnt(E(f), c, n)));
  const T = {
    en: {
      A: () => `This painting makes people feel ${E(s.order[0][0])}.`,
      B: () => `Viewers selected ${cnts(s.order.slice(0, 3))}.`,
      leader: () => `More viewers selected ${cnts([s.order[0]])}, although some selected other emotions, such as ${cnts(s.order.slice(1, 3))}.`,
      varied: () => `Viewer responses varied. The three most frequent were ${cnts(s.order.slice(0, 3))}.`,
      few: () => `Only ${s.nEmotion < n ? `${s.nEmotion} of the ${n} viewers selected an emotion` : `${n} viewers responded`}, so the available data are insufficient to determine reliably whether viewers agree. They selected ${cnts(s.order.slice(0, 3))}.`,
      opp: ' Some of these emotions point in opposite directions (positive and negative).',
      model: () => `An AI guessed: mostly ${E(s.model[0])}, with some ${E(s.model[1])} and ${E(s.model[2])}. This is a computer's guess, not what people chose.`,
    },
    'zh-Hant': {
      A: () => `這幅畫讓人感到${E(s.order[0][0])}。`,
      B: () => `觀看者選擇了${cnts(s.order.slice(0, 3))}。`,
      leader: () => `較多觀看者選擇了${cnts([s.order[0]])}，不過也有人選擇了其他情緒，例如${cnts(s.order.slice(1, 3))}。`,
      varied: () => `觀看者的反應各不相同。最常見的三種是${cnts(s.order.slice(0, 3))}。`,
      few: () => `${s.nEmotion < n ? `${n} 位觀看者中只有 ${s.nEmotion} 位選擇了情緒` : `只有 ${n} 位觀看者作答`}，資料不足以可靠判斷觀看者的意見是否一致。他們選擇了${cnts(s.order.slice(0, 3))}。`,
      opp: '其中一些情緒的方向相反（正面與負面）。',
      model: () => `AI 猜測：主要是${E(s.model[0])}，也有一些${E(s.model[1])}和${E(s.model[2])}。這是電腦的猜測，不是人們的選擇。`,
    },
    fr: {
      A: () => `Ce tableau fait ressentir : ${E(s.order[0][0])}.`,
      B: () => `Les spectateurs ont choisi : ${cnts(s.order.slice(0, 3))}.`,
      leader: () => `Davantage de spectateurs ont choisi ${cnts([s.order[0]])}, même si certains ont choisi d’autres émotions, par exemple ${cnts(s.order.slice(1, 3))}.`,
      varied: () => `Les réactions des spectateurs ont varié. Les trois plus fréquentes : ${cnts(s.order.slice(0, 3))}.`,
      few: () => `${s.nEmotion < n ? `Seuls ${s.nEmotion} des ${n} spectateurs ont choisi une émotion` : `Seuls ${n} spectateurs ont répondu`} ; les données ne suffisent donc pas pour savoir de façon fiable si les spectateurs sont d’accord. Ils ont choisi : ${cnts(s.order.slice(0, 3))}.`,
      opp: ' Certaines de ces émotions vont dans des directions opposées (positive et négative).',
      model: () => `Une IA a deviné : surtout ${E(s.model[0])}, avec un peu de ${E(s.model[1])} et de ${E(s.model[2])}. C’est la supposition d’un ordinateur, pas le choix des personnes.`,
    },
    ar: {
      A: () => `هذه اللوحة تجعل الناس يشعرون بـ: ${E(s.order[0][0])}.`,
      B: () => `اختار المشاهدون: ${cnts(s.order.slice(0, 3))}.`,
      leader: () => `اختار عدد أكبر من المشاهدين ${cnts([s.order[0]])}، مع أن بعضهم اختار مشاعر أخرى، مثل ${cnts(s.order.slice(1, 3))}.`,
      varied: () => `تنوّعت ردود فعل المشاهدين. وكانت الثلاثة الأكثر تكرارًا: ${cnts(s.order.slice(0, 3))}.`,
      few: () => `${s.nEmotion < n ? `اختار ${s.nEmotion} فقط من أصل ${n} مشاهدين شعورًا ما` : `أجاب ${n} مشاهدين فقط`}، لذلك لا تكفي البيانات لمعرفة ما إذا كان المشاهدون متفقين بشكل موثوق. وقد اختاروا: ${cnts(s.order.slice(0, 3))}.`,
      opp: ' بعض هذه المشاعر في اتجاهين متعاكسين (إيجابي وسلبي).',
      model: () => `خمّن الذكاء الاصطناعي: غالبًا ${E(s.model[0])}، مع بعض ${E(s.model[1])} و${E(s.model[2])}. هذا تخمين حاسوب، وليس ما اختاره الناس.`,
    },
  }[lang];
  if (cond === 'model') return T.model();
  if (cond === 'A') return T.A();
  if (cond === 'B') return T.B();
  // C never lists more than 3 emotions (same amount of information as B); the 'opposite directions' sentence is
  // added only when the 3 emotions shown include both a positive and a negative one.
  const shown = s.order.slice(0, 3).map(([f]) => f);
  const opp = shown.some((f) => POSITIVE.includes(f)) && shown.some((f) => NEGATIVE.includes(f));
  return T[s.rule]() + (opp ? T.opp : '');
}

const UI = {
  en: {
    title: 'How do people feel about paintings?', closed: 'This study is not open yet. Thank you for your interest!',
    chooseLang: 'Choose your language', next: 'Next', cont: 'Continue', read: 'I have read it', start: 'Start',
    infoH: 'About this study',
    info: ['This is a research study by the AI and New Media Art Laboratory, National Taichung University of Education (Taiwan).',
      'It tests different ways of describing how people felt about paintings. You will look at 20 paintings, read short descriptions and answer simple questions. It takes about 20 minutes.',
      'There are no right or wrong feelings. The questions only ask about what you read.',
      'Taking part is voluntary. You can stop at any time by closing the page; nothing is kept from an unfinished session except the answers already sent.',
      'We do not ask for your name, e-mail or any personal information. Your answers are anonymous and used only for research.',
      'You must be 18 or older.'],
    contact: 'Questions about the study: ', age: 'I am 18 years old or older.', agree: 'I have read the information above and agree to take part.',
    introH: 'How it works',
    intro: ['Look at the painting. You can select emotions it gives you (optional, not saved).', 'Read a short description and a model prediction.', 'Answer two questions. The description is hidden then, so read it carefully.'],
    introEnd: 'We start with 2 practice paintings.', startPractice: 'Start the practice',
    practice: (i, n) => `Practice ${i} of ${n}`, painting: (i, n) => `Painting ${i} of ${n}`,
    feel: 'How does this painting make you feel? Select any emotions that fit (optional, not saved).', descH: 'Description',
    q1: 'From what you read, how did earlier viewers respond to this painting?',
    q1o: { leader: 'One emotion was clearly more common than the others', varied: 'Viewers responded in varied ways', few: 'There were too few responses to tell', dontknow: "I don't know" },
    q2: 'Which emotion did earlier viewers select most often?', dontknow: "I don't know",
    readyH: 'Practice done', ready: 'Now the 18 study paintings begin, in 3 parts of 6, with two short questions after each part.', begin: 'Begin',
    rateH: 'About the last 6 descriptions', r1: 'The descriptions left room for my own response.', r2: 'The descriptions were hard to understand.',
    dis: 'strongly disagree', agr: 'strongly agree',
    susH: 'About the app', susIntro: 'For each statement, choose how much you agree (1 = strongly disagree, 5 = strongly agree).',
    sus: ['I think that I would like to use this app frequently.', 'I found the app unnecessarily complex.', 'I thought the app was easy to use.',
      'I think that I would need the support of a technical person to be able to use this app.', 'I found the various functions in this app were well integrated.',
      'I thought there was too much inconsistency in this app.', 'I would imagine that most people would learn to use this app very quickly.',
      'I found the app very cumbersome to use.', 'I felt very confident using the app.', 'I needed to learn a lot of things before I could get going with this app.'],
    attention: 'To show that you are reading carefully, please choose 2 here.',
    finish: 'Finish', endH: 'Thank you!', end: 'Your answers have been saved. You can close this page.', code: 'Your completion code: ',
    sending: 'Saving your answers…', failed: 'Your answers could not be sent. Please keep this page open and try again.', retry: 'Try again',
  },
  'zh-Hant': {
    title: '人們對畫作有什麼感受？', closed: '本研究尚未開放。謝謝您的關注！',
    chooseLang: '請選擇語言', next: '下一步', cont: '繼續', read: '我已閱讀', start: '開始',
    infoH: '關於本研究',
    info: ['這是國立臺中教育大學（臺灣）人工智慧與新媒體藝術實驗室的研究。',
      '本研究比較描述「人們對畫作的感受」的不同方式。您將觀看 20 幅畫作、閱讀簡短描述並回答簡單問題，約需 20 分鐘。',
      '感受沒有對錯之分，問題只詢問您所讀到的內容。',
      '參與完全自願。您可隨時關閉頁面停止參與；未完成的作答除了已送出的答案外不會保留。',
      '我們不會詢問您的姓名、電子郵件或任何個人資料。您的回答是匿名的，僅用於研究。',
      '您必須年滿 18 歲。'],
    contact: '對本研究有疑問請聯絡：', age: '我已年滿 18 歲。', agree: '我已閱讀以上說明並同意參與。',
    introH: '進行方式',
    intro: ['觀看畫作。您可以選擇畫作帶給您的情緒（可略過，不會儲存）。', '閱讀一段簡短描述和一則模型預測。', '回答兩個問題。此時描述會被隱藏，請仔細閱讀。'],
    introEnd: '我們先進行 2 幅練習畫作。', startPractice: '開始練習',
    practice: (i, n) => `練習 ${i} / ${n}`, painting: (i, n) => `畫作 ${i} / ${n}`,
    feel: '這幅畫給您什麼感受？請選擇符合的情緒（可略過，不會儲存）。', descH: '描述',
    q1: '根據您讀到的內容，之前的觀看者對這幅畫的反應如何？',
    q1o: { leader: '有一種情緒明顯比其他情緒更常見', varied: '觀看者的反應各不相同', few: '作答人數太少，無法判斷', dontknow: '我不知道' },
    q2: '之前的觀看者最常選擇哪一種情緒？', dontknow: '我不知道',
    readyH: '練習完成', ready: '現在開始 18 幅正式畫作，分為 3 部分，每部分 6 幅，每部分結束後有兩個簡短問題。', begin: '開始',
    rateH: '關於剛才的 6 段描述', r1: '這些描述讓我保有自己的感受空間。', r2: '這些描述很難理解。',
    dis: '非常不同意', agr: '非常同意',
    susH: '關於這個應用程式', susIntro: '請就每個敘述選擇您的同意程度（1 = 非常不同意，5 = 非常同意）。',
    sus: ['我想我會經常使用這個應用程式。', '我覺得這個應用程式過於複雜。', '我覺得這個應用程式很容易使用。', '我想我需要技術人員的協助才能使用這個應用程式。',
      '我覺得這個應用程式的各項功能整合得很好。', '我覺得這個應用程式有太多不一致的地方。', '我想大多數人都能很快學會使用這個應用程式。',
      '我覺得這個應用程式使用起來很麻煩。', '我在使用這個應用程式時很有信心。', '在開始使用這個應用程式之前，我需要學習很多東西。'],
    attention: '為了確認您有仔細閱讀，請在此選擇 2。',
    finish: '完成', endH: '謝謝您！', end: '您的回答已儲存，您可以關閉此頁面。', code: '您的完成代碼：',
    sending: '正在儲存您的回答…', failed: '無法送出您的回答。請保持此頁面開啟並再試一次。', retry: '再試一次',
  },
  fr: {
    title: 'Que ressentent les gens devant des tableaux ?', closed: 'Cette étude n’est pas encore ouverte. Merci de votre intérêt !',
    chooseLang: 'Choisissez votre langue', next: 'Suivant', cont: 'Continuer', read: 'J’ai lu', start: 'Commencer',
    infoH: 'À propos de cette étude',
    info: ['Cette étude est menée par le laboratoire IA et arts des nouveaux médias de l’Université nationale d’éducation de Taichung (Taïwan).',
      'Elle compare différentes façons de décrire ce que des personnes ont ressenti devant des tableaux. Vous verrez 20 tableaux, lirez de courtes descriptions et répondrez à des questions simples. Cela prend environ 20 minutes.',
      'Il n’y a pas de bons ou de mauvais ressentis. Les questions portent seulement sur ce que vous avez lu.',
      'La participation est volontaire. Vous pouvez arrêter à tout moment en fermant la page ; d’une session inachevée, seules les réponses déjà envoyées sont conservées.',
      'Nous ne demandons ni votre nom, ni votre e-mail, ni aucune information personnelle. Vos réponses sont anonymes et servent uniquement à la recherche.',
      'Vous devez avoir 18 ans ou plus.'],
    contact: 'Questions sur l’étude : ', age: 'J’ai 18 ans ou plus.', agree: 'J’ai lu les informations ci-dessus et j’accepte de participer.',
    introH: 'Déroulement',
    intro: ['Regardez le tableau. Vous pouvez choisir les émotions qu’il vous inspire (facultatif, non enregistré).', 'Lisez une courte description et une prédiction du modèle.', 'Répondez à deux questions. La description est alors masquée : lisez-la attentivement.'],
    introEnd: 'Nous commençons par 2 tableaux d’entraînement.', startPractice: 'Commencer l’entraînement',
    practice: (i, n) => `Entraînement ${i} sur ${n}`, painting: (i, n) => `Tableau ${i} sur ${n}`,
    feel: 'Que vous fait ressentir ce tableau ? Choisissez les émotions qui conviennent (facultatif, non enregistré).', descH: 'Description',
    q1: 'D’après ce que vous avez lu, comment les spectateurs précédents ont-ils réagi à ce tableau ?',
    q1o: { leader: 'Une émotion était nettement plus fréquente que les autres', varied: 'Les réactions des spectateurs étaient variées', few: 'Il y avait trop peu de réponses pour le savoir', dontknow: 'Je ne sais pas' },
    q2: 'Quelle émotion les spectateurs précédents ont-ils choisie le plus souvent ?', dontknow: 'Je ne sais pas',
    readyH: 'Entraînement terminé', ready: 'Les 18 tableaux de l’étude commencent maintenant, en 3 parties de 6, avec deux courtes questions après chaque partie.', begin: 'Commencer',
    rateH: 'À propos des 6 dernières descriptions', r1: 'Les descriptions laissaient de la place à mon propre ressenti.', r2: 'Les descriptions étaient difficiles à comprendre.',
    dis: 'pas du tout d’accord', agr: 'tout à fait d’accord',
    susH: 'À propos de l’application', susIntro: 'Pour chaque affirmation, indiquez votre degré d’accord (1 = pas du tout d’accord, 5 = tout à fait d’accord).',
    sus: ['Je pense que j’aimerais utiliser cette application fréquemment.', 'J’ai trouvé l’application inutilement complexe.', 'J’ai trouvé l’application facile à utiliser.',
      'Je pense que j’aurais besoin de l’aide d’une personne technique pour pouvoir utiliser cette application.', 'J’ai trouvé que les différentes fonctions de l’application étaient bien intégrées.',
      'J’ai trouvé qu’il y avait trop d’incohérences dans cette application.', 'J’imagine que la plupart des gens apprendraient très vite à utiliser cette application.',
      'J’ai trouvé l’application très lourde à utiliser.', 'Je me suis senti(e) très en confiance en utilisant l’application.', 'J’ai dû apprendre beaucoup de choses avant de pouvoir utiliser cette application.'],
    attention: 'Pour montrer que vous lisez attentivement, choisissez 2 ici.',
    finish: 'Terminer', endH: 'Merci !', end: 'Vos réponses ont été enregistrées. Vous pouvez fermer cette page.', code: 'Votre code de fin : ',
    sending: 'Enregistrement de vos réponses…', failed: 'Vos réponses n’ont pas pu être envoyées. Gardez cette page ouverte et réessayez.', retry: 'Réessayer',
  },
  ar: {
    title: 'ماذا يشعر الناس أمام اللوحات الفنية؟', closed: 'هذه الدراسة غير مفتوحة بعد. شكرًا لاهتمامك!',
    chooseLang: 'اختر لغتك', next: 'التالي', cont: 'متابعة', read: 'قرأتُ النص', start: 'ابدأ',
    infoH: 'عن هذه الدراسة',
    info: ['هذه دراسة بحثية يجريها مختبر الذكاء الاصطناعي وفنون الوسائط الجديدة في جامعة تايتشونغ الوطنية للتربية (تايوان).',
      'تقارن الدراسة بين طرق مختلفة لوصف ما شعر به الناس أمام اللوحات. ستشاهد 20 لوحة وتقرأ أوصافًا قصيرة وتجيب عن أسئلة بسيطة. تستغرق نحو 20 دقيقة.',
      'لا توجد مشاعر صحيحة أو خاطئة. الأسئلة تتعلق فقط بما قرأته.',
      'المشاركة طوعية. يمكنك التوقف في أي وقت بإغلاق الصفحة؛ ولا يُحتفظ من الجلسة غير المكتملة إلا بالإجابات التي أُرسلت.',
      'لا نطلب اسمك أو بريدك الإلكتروني أو أي معلومات شخصية. إجاباتك مجهولة الهوية وتُستخدم للبحث فقط.',
      'يجب أن يكون عمرك 18 عامًا أو أكثر.'],
    contact: 'للأسئلة حول الدراسة: ', age: 'عمري 18 عامًا أو أكثر.', agree: 'قرأتُ المعلومات أعلاه وأوافق على المشاركة.',
    introH: 'طريقة المشاركة',
    intro: ['انظر إلى اللوحة. يمكنك اختيار المشاعر التي تثيرها فيك (اختياري، لا يُحفظ).', 'اقرأ وصفًا قصيرًا وتوقّعًا من النموذج.', 'أجب عن سؤالين. سيُخفى الوصف عندها، لذا اقرأه بعناية.'],
    introEnd: 'نبدأ بلوحتين للتدريب.', startPractice: 'ابدأ التدريب',
    practice: (i, n) => `تدريب ${i} من ${n}`, painting: (i, n) => `اللوحة ${i} من ${n}`,
    feel: 'ما الذي تشعر به أمام هذه اللوحة؟ اختر المشاعر المناسبة (اختياري، لا يُحفظ).', descH: 'الوصف',
    q1: 'بحسب ما قرأت، كيف كانت ردود فعل المشاهدين السابقين على هذه اللوحة؟',
    q1o: { leader: 'كان شعور واحد أكثر شيوعًا بوضوح من غيره', varied: 'تنوّعت ردود فعل المشاهدين', few: 'كانت الإجابات قليلة جدًا لمعرفة ذلك', dontknow: 'لا أعرف' },
    q2: 'ما الشعور الذي اختاره المشاهدون السابقون أكثر من غيره؟', dontknow: 'لا أعرف',
    readyH: 'انتهى التدريب', ready: 'تبدأ الآن لوحات الدراسة الثماني عشرة، في 3 أجزاء من 6 لوحات، مع سؤالين قصيرين بعد كل جزء.', begin: 'ابدأ',
    rateH: 'عن الأوصاف الستة الأخيرة', r1: 'تركت الأوصاف مجالًا لشعوري الخاص.', r2: 'كان فهم الأوصاف صعبًا.',
    dis: 'لا أوافق إطلاقًا', agr: 'أوافق تمامًا',
    susH: 'عن التطبيق', susIntro: 'لكل عبارة، اختر مدى موافقتك (1 = لا أوافق إطلاقًا، 5 = أوافق تمامًا).',
    sus: ['أعتقد أنني أرغب في استخدام هذا التطبيق كثيرًا.', 'وجدت التطبيق معقدًا بلا داعٍ.', 'وجدت التطبيق سهل الاستخدام.',
      'أعتقد أنني سأحتاج إلى مساعدة شخص تقني لأتمكن من استخدام هذا التطبيق.', 'وجدت أن وظائف التطبيق المختلفة متكاملة بشكل جيد.',
      'وجدت أن في هذا التطبيق الكثير من عدم الاتساق.', 'أتخيل أن معظم الناس سيتعلمون استخدام هذا التطبيق بسرعة كبيرة.',
      'وجدت التطبيق مرهقًا جدًا في الاستخدام.', 'شعرت بثقة كبيرة أثناء استخدام التطبيق.', 'احتجت إلى تعلم أشياء كثيرة قبل أن أتمكن من استخدام هذا التطبيق.'],
    attention: 'لتُظهر أنك تقرأ بعناية، اختر 2 هنا.',
    finish: 'إنهاء', endH: 'شكرًا لك!', end: 'تم حفظ إجاباتك. يمكنك إغلاق هذه الصفحة.', code: 'رمز الإكمال الخاص بك: ',
    sending: 'جارٍ حفظ إجاباتك…', failed: 'تعذّر إرسال إجاباتك. أبقِ هذه الصفحة مفتوحة وحاول مرة أخرى.', retry: 'حاول مرة أخرى',
  },
};

// ---- Added for participants outside the field: who the "earlier viewers" are, practice feedback, hard emotion words.
const EXTRA = {
  en: {
    explain: 'For each painting, about 10 people looked at it before you and chose the emotions they felt. You will read a short description of their answers, and a guess made by a computer program (AI).',
    fbH: 'Check your answer', right: 'Correct!', wrong: 'Not quite.',
    fbQ1: { leader: 'one emotion was chosen by many more people than the others', varied: 'several emotions were chosen by similar numbers of people', few: 'too few people answered to be sure' },
    fbQ1t: (ans, why) => `The right answer is “${ans}”, because ${why}.`,
    fbQ2t: (v, m) => `Earlier viewers chose “${v}” most often. “${m}” was the AI's guess, not what the viewers chose.`,
    gH: 'What do some emotion words mean?',
    g: { humility: 'feeling modest, not proud', anticipation: 'waiting for or looking forward to something', trust: 'feeling you can rely on someone', agreeableness: 'feeling friendly and kind', disagreeableness: 'feeling unfriendly or hostile', arrogance: 'feeling better than others' },
  },
  'zh-Hant': {
    explain: '每幅畫在您之前都有大約 10 個人看過，並選擇了他們的感受。您會讀到一段簡短的描述，說明他們的回答，以及一個電腦程式（AI）的猜測。',
    fbH: '檢查您的答案', right: '答對了！', wrong: '不太對。',
    fbQ1: { leader: '有一種情緒被選擇的人數明顯比其他情緒多', varied: '有幾種情緒被選擇的人數差不多', few: '作答的人太少，無法確定' },
    fbQ1t: (ans, why) => `正確答案是「${ans}」，因為${why}。`,
    fbQ2t: (v, m) => `之前的觀看者最常選擇${v}。${m}是 AI 的猜測，不是觀看者的選擇。`,
    gH: '一些情緒詞是什麼意思？',
    g: { humility: '感到謙虛，不驕傲', anticipation: '等待或期待某件事', trust: '覺得可以依靠某人', agreeableness: '感到友善、親切', disagreeableness: '感到不友善或有敵意', arrogance: '覺得自己比別人優越' },
  },
  fr: {
    explain: 'Pour chaque tableau, une dizaine de personnes l’ont regardé avant vous et ont choisi les émotions qu’elles ressentaient. Vous lirez une courte description de leurs réponses, et une estimation faite par un programme informatique (IA).',
    fbH: 'Vérifiez votre réponse', right: 'Correct !', wrong: 'Pas tout à fait.',
    fbQ1: { leader: 'une émotion a été choisie par beaucoup plus de personnes que les autres', varied: 'plusieurs émotions ont été choisies par des nombres de personnes proches', few: 'trop peu de personnes ont répondu pour en être sûr' },
    fbQ1t: (ans, why) => `La bonne réponse est « ${ans} », car ${why}.`,
    fbQ2t: (v, m) => `Les spectateurs précédents ont choisi le plus souvent : ${v}. « ${m} » était l’estimation de l’IA, pas le choix des spectateurs.`,
    gH: 'Que veulent dire certains mots d’émotion ?',
    g: { humility: 'se sentir modeste, sans fierté', anticipation: 'attendre quelque chose ou s’en réjouir à l’avance', trust: 'sentir qu’on peut compter sur quelqu’un', agreeableness: 'se sentir aimable et bienveillant', disagreeableness: 'se sentir hostile ou peu aimable', arrogance: 'se sentir supérieur aux autres' },
  },
  ar: {
    explain: 'لكل لوحة، شاهدها نحو 10 أشخاص قبلك واختاروا المشاعر التي شعروا بها. ستقرأ وصفًا قصيرًا لإجاباتهم، وتخمينًا من برنامج حاسوبي (ذكاء اصطناعي).',
    fbH: 'تحقّق من إجابتك', right: 'إجابة صحيحة!', wrong: 'ليست صحيحة تمامًا.',
    fbQ1: { leader: 'شعورًا واحدًا اختاره عدد أكبر بكثير من الناس مقارنةً بغيره', varied: 'عدة مشاعر اختارها أعداد متقاربة من الناس', few: 'عدد الذين أجابوا قليل جدًا للتأكد' },
    fbQ1t: (ans, why) => `الإجابة الصحيحة هي «${ans}»، لأن ${why}.`,
    fbQ2t: (v, m) => `اختار المشاهدون السابقون «${v}» أكثر من غيره. أما «${m}» فكان تخمين الذكاء الاصطناعي، وليس اختيار المشاهدين.`,
    gH: 'ماذا تعني بعض كلمات المشاعر؟',
    g: { humility: 'الشعور بالتواضع وعدم التكبّر', anticipation: 'انتظار شيء ما أو التطلّع إليه', trust: 'الشعور بأنه يمكن الاعتماد على شخص ما', agreeableness: 'الشعور بالود واللطف', disagreeableness: 'الشعور بعدم الود أو بالعداء', arrogance: 'الشعور بالتفوّق على الآخرين' },
  },
};
Object.keys(EXTRA).forEach((l) => Object.assign(UI[l], EXTRA[l]));

// ---- Friendlier design: landing page, part breaks, try again in the practice, sharing at the end.
const EXTRA2 = {
  en: { studyWord: 'Research study', zoom: 'See the painting bigger', sub: 'Look at paintings, read what other people felt, and help us test better art descriptions.', pills: ['About 20 minutes', 'Anonymous', 'No art knowledge needed'],
    partDone: (k) => `Part ${k} of 3 done!`, cheer: ['Nice start. Two quick questions, then the next part.', 'Two-thirds done. Three quick questions, then the last part.', 'Last part done. Two quick questions and you are finished!'],
    tryAgain: 'Read it again and try again', share: 'Share the study', copied: 'Link copied!', shareText: 'A 20-minute study about how people feel about paintings:' },
  'zh-Hant': { studyWord: '研究問卷', zoom: '放大看這幅畫', sub: '欣賞畫作、閱讀其他人的感受，幫助我們測試更好的藝術描述。', pills: ['約 20 分鐘', '匿名', '不需要藝術知識'],
    partDone: (k) => `第 ${k} 部分（共 3 部分）完成！`, cheer: ['好的開始！回答兩個簡短問題後進入下一部分。', '已完成三分之二！回答三個簡短問題後進入最後一部分。', '最後一部分完成！回答兩個簡短問題就結束了！'],
    tryAgain: '再讀一次並重新作答', share: '分享這項研究', copied: '已複製連結！', shareText: '一項約 20 分鐘、關於人們對畫作感受的研究：' },
  fr: { studyWord: 'Étude de recherche', zoom: 'Voir le tableau en plus grand', sub: 'Regardez des tableaux, lisez ce que d’autres personnes ont ressenti, et aidez-nous à tester de meilleures descriptions.', pills: ['Environ 20 minutes', 'Anonyme', 'Aucune connaissance en art requise'],
    partDone: (k) => `Partie ${k} sur 3 terminée !`, cheer: ['Bon début. Deux petites questions, puis la partie suivante.', 'Deux tiers terminés. Trois petites questions, puis la dernière partie.', 'Dernière partie terminée. Deux petites questions et c’est fini !'],
    tryAgain: 'Relire et réessayer', share: 'Partager l’étude', copied: 'Lien copié !', shareText: 'Une étude de 20 minutes sur ce que les gens ressentent devant des tableaux :' },
  ar: { studyWord: 'دراسة بحثية', zoom: 'عرض اللوحة بحجم أكبر', sub: 'شاهد لوحات فنية، واقرأ ما شعر به الآخرون، وساعدنا في اختبار أوصاف أفضل للفن.', pills: ['نحو 20 دقيقة', 'مجهول الهوية', 'لا تحتاج إلى معرفة بالفن'],
    partDone: (k) => `انتهى الجزء ${k} من 3!`, cheer: ['بداية رائعة. سؤالان قصيران ثم الجزء التالي.', 'أنجزت الثلثين. ثلاثة أسئلة قصيرة ثم الجزء الأخير.', 'انتهى الجزء الأخير. سؤالان قصيران وتنتهي الدراسة!'],
    tryAgain: 'اقرأ مرة أخرى وأعد المحاولة', share: 'شارك الدراسة', copied: 'تم نسخ الرابط!', shareText: 'دراسة مدتها 20 دقيقة حول ما يشعر به الناس أمام اللوحات:' },
};
Object.keys(EXTRA2).forEach((l) => Object.assign(UI[l], EXTRA2[l]));

// ---- Simpler wording + texts for the friendlier design (Nov 2026). Same meaning and same answer options as before.
const SIMPLE = {
  en: {
    welcomeSub: 'About 20 minutes · anonymous · no right or wrong feelings', letsGo: "Let's go",
    explain: 'Each painting was seen by about 10 people before you. They picked the feelings it gave them.',
    steps: [['👀', 'Look', 'Look at the painting.'], ['📖', 'Read', 'Read a short description of how the people before you felt, plus a guess from an AI.'], ['✅', 'Answer', 'Answer two simple questions. The description is hidden then, so read it well.']],
    feel: 'How does this painting make you feel? Tap any feelings (optional).',
    q1: 'How did the people before you feel about this painting?',
    q1o: { leader: 'One feeling stood out', varied: 'People felt many different things', few: 'Too few people answered to know', dontknow: "I'm not sure" },
    q2: 'Which feeling did they pick the most?', dontknow: "I'm not sure",
    good: "Great, you've got it!", hmm: "Almost! Here's the right answer:", tryAgain: 'Read it again',
    blockDone: (b) => `Part ${b} of 3 done!`, rateIntro: 'Two quick questions about the descriptions you just read:',
    r1: 'The descriptions left room for my own feelings.', susH: 'Quick feedback about this website', back: 'Back', endH: 'Thank you! 🎉',
  },
  'zh-Hant': {
    welcomeSub: '約 20 分鐘・匿名・感受沒有對錯', letsGo: '開始吧',
    explain: '每幅畫在您之前大約有 10 個人看過，他們選出了這幅畫帶給他們的感受。',
    steps: [['👀', '看', '看看這幅畫。'], ['📖', '讀', '讀一段簡短描述，說明之前的人有什麼感受，以及一個 AI 的猜測。'], ['✅', '答', '回答兩個簡單問題。這時描述會被隱藏，請仔細閱讀。']],
    feel: '這幅畫帶給您什麼感受？點選任何感受（可略過）。',
    q1: '在您之前的人對這幅畫有什麼感受？',
    q1o: { leader: '有一種感受特別突出', varied: '大家的感受很不一樣', few: '回答的人太少，無法知道', dontknow: '我不確定' },
    q2: '他們最常選擇哪一種感受？', dontknow: '我不確定',
    good: '太好了，您掌握了！', hmm: '差一點！正確答案是：', tryAgain: '再讀一次',
    blockDone: (b) => `第 ${b} 部分完成（共 3 部分）！`, rateIntro: '關於剛才讀到的描述，有兩個簡短問題：',
    r1: '這些描述讓我保有自己感受的空間。', susH: '關於這個網站的簡短回饋', back: '返回', endH: '謝謝您！🎉',
  },
  fr: {
    welcomeSub: 'Environ 20 minutes · anonyme · pas de bon ou de mauvais ressenti', letsGo: 'C’est parti',
    explain: 'Chaque tableau a été regardé par une dizaine de personnes avant vous. Elles ont choisi ce qu’elles ressentaient.',
    steps: [['👀', 'Regarder', 'Regardez le tableau.'], ['📖', 'Lire', 'Lisez une courte description de ce qu’ont ressenti les personnes avant vous, et une estimation d’une IA.'], ['✅', 'Répondre', 'Répondez à deux questions simples. La description est alors cachée : lisez-la bien.']],
    feel: 'Que vous fait ressentir ce tableau ? Touchez les émotions qui vous parlent (facultatif).',
    q1: 'Qu’ont ressenti les personnes avant vous devant ce tableau ?',
    q1o: { leader: 'Un sentiment se démarquait', varied: 'Les gens ont ressenti des choses très différentes', few: 'Trop peu de réponses pour le savoir', dontknow: 'Je ne suis pas sûr(e)' },
    q2: 'Quel sentiment ont-ils choisi le plus ?', dontknow: 'Je ne suis pas sûr(e)',
    good: 'Bravo, vous avez compris !', hmm: 'Presque ! Voici la bonne réponse :', tryAgain: 'Relire',
    blockDone: (b) => `Partie ${b} sur 3 terminée !`, rateIntro: 'Deux petites questions sur les descriptions que vous venez de lire :',
    r1: 'Les descriptions laissaient de la place à mes propres sentiments.', susH: 'Votre avis rapide sur ce site', back: 'Retour', endH: 'Merci ! 🎉',
  },
  ar: {
    welcomeSub: 'حوالي 20 دقيقة · مجهول الهوية · لا توجد مشاعر صحيحة أو خاطئة', letsGo: 'لنبدأ',
    explain: 'كل لوحة شاهدها نحو 10 أشخاص قبلك، واختاروا المشاعر التي أثارتها فيهم.',
    steps: [['👀', 'انظر', 'انظر إلى اللوحة.'], ['📖', 'اقرأ', 'اقرأ وصفًا قصيرًا لما شعر به الأشخاص قبلك، وتخمينًا من الذكاء الاصطناعي.'], ['✅', 'أجب', 'أجب عن سؤالين بسيطين. سيُخفى الوصف عندها، لذا اقرأه جيدًا.']],
    feel: 'بماذا تشعر أمام هذه اللوحة؟ اضغط على أي شعور (اختياري).',
    q1: 'بماذا شعر الأشخاص الذين شاهدوا هذه اللوحة قبلك؟',
    q1o: { leader: 'برز شعور واحد', varied: 'شعر الناس بأشياء مختلفة كثيرًا', few: 'أجاب عدد قليل جدًا لمعرفة ذلك', dontknow: 'لست متأكدًا' },
    q2: 'ما الشعور الذي اختاروه أكثر من غيره؟', dontknow: 'لست متأكدًا',
    good: 'رائع، لقد فهمت!', hmm: 'اقتربت! إليك الإجابة الصحيحة:', tryAgain: 'اقرأ مرة أخرى',
    blockDone: (b) => `انتهى الجزء ${b} من 3!`, rateIntro: 'سؤالان سريعان عن الأوصاف التي قرأتها للتو:',
    r1: 'تركت الأوصاف مجالًا لمشاعري الخاصة.', susH: 'رأيك السريع في هذا الموقع', back: 'رجوع', endH: 'شكرًا لك! 🎉',
  },
};
Object.keys(SIMPLE).forEach((l) => Object.assign(UI[l], SIMPLE[l]));

// ---- Plainer screens (Nov 20): who the "viewers" are, clear card labels, word meanings shown automatically,
// and one example screen that explains the three possible answers before the practice.
const PLAIN = {
  en: {
    explain: 'Each painting was seen by about 10 people before you (the "viewers"). Each of them picked the feelings the painting gave them.',
    descH: 'What people felt', aiH: 'AI guess', meanH: 'Word meanings:',
    exH: 'The main question', exIntro: 'After each painting you will be asked how the people before you felt. There are three possible answers:',
    ex: { leader: 'Example: 9 of 11 people felt sadness, only 2 felt fear.', varied: 'Example: 4 felt happiness, 3 felt surprise, 3 felt trust. No clear winner.', few: 'Example: the description says there is not enough data.' },
    exNote: 'The AI guess is shown too, but the questions are always about what the people chose.', exGo: 'Got it, start the practice',
  },
  'zh-Hant': {
    explain: '每幅畫在您之前大約有 10 個人看過（即「觀看者」）。每個人都選出了這幅畫帶給他們的感受。',
    descH: '人們的感受', aiH: 'AI 猜測', meanH: '詞語意思：',
    exH: '主要問題', exIntro: '每幅畫之後，我們會問您：之前的人有什麼感受？可能的答案有三種：',
    ex: { leader: '例如：11 人中有 9 人感到悲傷，只有 2 人感到恐懼。', varied: '例如：4 人感到快樂，3 人感到驚訝，3 人感到信任，沒有明顯的多數。', few: '例如：描述中說資料不足。' },
    exNote: '畫面上也會顯示 AI 的猜測，但問題問的永遠是人們的選擇。', exGo: '明白了，開始練習',
  },
  fr: {
    explain: 'Chaque tableau a été regardé par une dizaine de personnes avant vous (les « spectateurs »). Chacune a choisi ce que le tableau lui faisait ressentir.',
    descH: 'Ce que les gens ont ressenti', aiH: 'Supposition de l’IA', meanH: 'Sens des mots :',
    exH: 'La question principale', exIntro: 'Après chaque tableau, on vous demandera ce qu’ont ressenti les personnes avant vous. Il y a trois réponses possibles :',
    ex: { leader: 'Exemple : 9 personnes sur 11 ont ressenti de la tristesse, seulement 2 de la peur.', varied: 'Exemple : 4 ont ressenti de la joie, 3 de la surprise, 3 de la confiance. Aucun sentiment ne domine.', few: 'Exemple : la description dit qu’il n’y a pas assez de données.' },
    exNote: 'La supposition de l’IA est aussi affichée, mais les questions portent toujours sur le choix des personnes.', exGo: 'Compris, commencer l’entraînement',
  },
  ar: {
    explain: 'كل لوحة شاهدها نحو 10 أشخاص قبلك («المشاهدون»). اختار كلٌّ منهم المشاعر التي أثارتها اللوحة فيه.',
    descH: 'ما شعر به الناس', aiH: 'تخمين الذكاء الاصطناعي', meanH: 'معاني الكلمات:',
    exH: 'السؤال الرئيسي', exIntro: 'بعد كل لوحة سنسألك: بماذا شعر الأشخاص قبلك؟ هناك ثلاث إجابات ممكنة:',
    ex: { leader: 'مثال: 9 من أصل 11 شخصًا شعروا بالحزن، و2 فقط بالخوف.', varied: 'مثال: 4 شعروا بالسعادة، و3 بالدهشة، و3 بالثقة. لا يوجد شعور غالب.', few: 'مثال: يقول الوصف إن البيانات غير كافية.' },
    exNote: 'يظهر تخمين الذكاء الاصطناعي أيضًا، لكن الأسئلة تتعلق دائمًا بما اختاره الناس.', exGo: 'فهمت، ابدأ التدريب',
  },
};
Object.keys(PLAIN).forEach((l) => Object.assign(UI[l], PLAIN[l]));

// ---- continue after a refresh
const RESUME = {
  en: { resumeH: 'Welcome back!', resumeP: (k) => `Your answers are safe. You stopped after ${k} of 18 paintings. Continue where you left off?`, resumeGo: 'Continue', restart: 'Start again', doneBefore: 'You have already taken part in this study. Thank you very much!' },
  'zh-Hant': { resumeH: '歡迎回來！', resumeP: (k) => `您的答案已保存。您完成了 18 幅畫中的 ${k} 幅。要從上次停下的地方繼續嗎？`, resumeGo: '繼續', restart: '重新開始', doneBefore: '您已經參加過這項研究。非常感謝！' },
  fr: { resumeH: 'Bon retour !', resumeP: (k) => `Vos réponses sont enregistrées. Vous vous êtes arrêté(e) après ${k} tableaux sur 18. Reprendre là où vous en étiez ?`, resumeGo: 'Continuer', restart: 'Recommencer', doneBefore: 'Vous avez déjà participé à cette étude. Merci beaucoup !' },
  ar: { resumeH: 'مرحبًا بعودتك!', resumeP: (k) => `إجاباتك محفوظة. توقفت بعد ${k} من أصل 18 لوحة. هل تريد المتابعة من حيث توقفت؟`, resumeGo: 'متابعة', restart: 'البدء من جديد', doneBefore: 'لقد شاركت في هذه الدراسة من قبل. شكرًا جزيلًا!' },
};
Object.keys(RESUME).forEach((l) => Object.assign(UI[l], RESUME[l]));
