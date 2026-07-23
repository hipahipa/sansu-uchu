/* =====================================================================
   topics.js  ―  22分野の「問題生成」と「つまずき診断」エンジン
   ---------------------------------------------------------------------
   各 topic は以下を持つ:
     id        : 一意ID
     name      : 表示名
     emoji     : アイコン
     group     : 分類（画面のグルーピング用）
     grade     : おおよその学年
     answerType: 'int' | 'dec' | 'frac' | 'quorem'  (回答入力の種類)
     gen()     : 問題を1問生成 → { text, unit?, ...meta, answer }
     diagnose(ans, p): 採点＋つまずき診断
                 → { correct:bool, tag?, title?, msg?, hint? }
                 correct=false のとき、典型誤答に一致すれば tag/title/msg/hint を返す
   ===================================================================== */

const R = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

// 分数を約分した [num, den] で返す
function reduceFrac(n, d) {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

// 分数を「横棒つき」HTMLで表示する（/ を使わない）
function fr(n, d) {
  return `<span class="fr"><span class="fr-n">${n}</span><span class="fr-d">${d}</span></span>`;
}
// 1より大きい約数（自分自身を含む）の一覧
function divisorsOver1(n) {
  const out = [];
  for (let k = 2; k <= n; k++) if (n % k === 0) out.push(k);
  return out;
}

// つまずきカードのヘルパ
function miss(tag, title, msg, hint) {
  return { correct: false, tag, title, msg, hint };
}
const WRONG = { correct: false }; // 診断名なしの不正解

const TOPICS = [
  /* ①20以下のたし算・ひき算 ------------------------------------------ */
  {
    id: "add-sub-20",
    name: "20までの たし算・ひき算",
    emoji: "🍎",
    group: "整数の計算",
    grade: "1年",
    answerType: "int",
    gen() {
      if (Math.random() < 0.5) {
        // たし算（くり上がりを半分くらい入れる）
        let a = R(2, 9), b = R(2, 9);
        if (a + b <= 10 && Math.random() < 0.6) b = R(11 - a, 9); // くり上がり狙い
        return { text: `${a} + ${b}`, a, b, op: "+", answer: a + b };
      } else {
        // ひき算（くり下がりを半分くらい入れる）
        let a = R(11, 18), b = R(2, 9);
        if (a - b >= 10 && Math.random() < 0.6) b = R(a - 9, 9); // くり下がり狙い
        if (b > a) [a, b] = [b, a];
        return { text: `${a} − ${b}`, a, b, op: "-", answer: a - b };
      }
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.op === "+") {
        // くり上がり忘れ：一の位だけ書いた
        if (p.answer >= 10 && ans === p.answer % 10)
          return miss("carry-forget", "くり上がりを わすれているみたい",
            `${p.a}＋${p.b}は10をこえるよ。一のくらいだけでなく、10のくらいのくり上がりもたそう。`,
            "10のかたまりを作って、のこりをたすと数えやすいよ。");
      } else {
        // くり下がりできず、小さい方から引いた（逆引き）
        const onesA = p.a % 10, tens = Math.floor(p.a / 10);
        if (p.b > onesA && ans === tens * 10 + (p.b - onesA))
          return miss("borrow-reverse", "ひけないところを ぎゃくに ひいたみたい",
            `一のくらいは ${onesA}−${p.b} で ひけないね。ぎゃくに ${p.b}−${onesA} を していない？ 十のくらいから 10を もらってこよう。`,
            `13−5 なら、13を 10と3に 分けて、10−5＝5、それに 3を たして 8。`);
      }
      return WRONG;
    },
  },

  /* ②100以下のたし算・ひき算 ----------------------------------------- */
  {
    id: "add-sub-100",
    name: "100までの たし算・ひき算",
    emoji: "🧮",
    group: "整数の計算",
    grade: "2年",
    answerType: "int",
    gen() {
      if (Math.random() < 0.5) {
        const a = R(13, 79), b = R(13, 20 - (a % 10) + 15); // くり上がりが出やすい
        return { text: `${a} + ${b}`, a, b, op: "+", answer: a + b };
      } else {
        let a = R(30, 98), b = R(13, 49);
        if (b > a) [a, b] = [b, a];
        return { text: `${a} − ${b}`, a, b, op: "-", answer: a - b };
      }
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.op === "+") {
        // 一の位のくり上がりを十の位に足し忘れ
        const noCarry = (Math.floor(p.a / 10) + Math.floor(p.b / 10)) * 10 + ((p.a % 10) + (p.b % 10)) % 10;
        if ((p.a % 10) + (p.b % 10) >= 10 && ans === noCarry)
          return miss("carry-forget", "くり上がりを 上の位に たし忘れているみたい",
            `一のくらいの ${p.a % 10}＋${p.b % 10} は10をこえるから、十のくらいへ 1くり上げる必要があるよ。`,
            "筆算では、くり上げた1を小さくメモしてから十のくらいをたそう。");
      } else {
        // 各位を「大きい方−小さい方」で引いた（位ごとの逆引き）
        const oa = p.a % 10, ob = p.b % 10;
        if (ob > oa) {
          const wrongOnes = ob - oa;
          const ta = Math.floor(p.a / 10), tb = Math.floor(p.b / 10);
          const cand = (ta - tb) * 10 + wrongOnes;
          if (ans === cand)
            return miss("borrow-reverse", "くり下がりをせず 位ごとに ぎゃく引きしたみたい",
              `一のくらいは ${oa}−${ob} で ひけないね。ぎゃくに 引かないで、十のくらいから 10を もらってこよう。`,
              `${oa}に 10を たして ${oa + 10}。${oa + 10}−${ob}＝${oa + 10 - ob} が 一のくらい。十のくらいは 10わたした分 1へるよ。`);
        }
      }
      return WRONG;
    },
  },

  /* ③かけ算九九 ------------------------------------------------------- */
  {
    id: "kuku",
    name: "かけ算 九九",
    emoji: "✖️",
    group: "整数の計算",
    grade: "2年",
    answerType: "int",
    // 9-10問目は「1けたの奇数×1けたの偶数×5」（順はランダム）の3つのかけ算
    gen(i) {
      if (i == null) i = R(0, 9);
      if (i >= 8) {
        const odd = pick([3, 5, 7, 9]), even = pick([2, 4, 6, 8]);
        const [a, b] = Math.random() < 0.5 ? [odd, even] : [even, odd];
        return { text: `${a} × ${b} × 5`, a, b, c: 5, three: true, answer: a * b * 5 };
      }
      const a = R(2, 9), b = R(2, 9);
      return { text: `${a} × ${b}`, a, b, answer: a * b };
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      // ---- 3つのかけ算（□×□×5）----
      if (p.three) {
        if (ans === p.a * p.b)
          return miss("forgot-times5", "さいごの ×5 を わすれているみたい",
            `${p.a}×${p.b}＝${p.a * p.b} のあと、5を かけるよ。`,
            `${p.a * p.b}×5＝${p.answer}。ぐう数×5は 10のかたまりに なるよ。`);
        if (ans === p.a * 5 || ans === p.b * 5)
          return miss("three-partial", "3つとも かけ算しよう",
            `${p.a}×${p.b}×5 は 3つの数を 全部 かけるよ。`,
            `まず ${p.a}×${p.b}＝${p.a * p.b}、次に ×5 で ${p.answer}。`);
        if (ans === p.a + p.b + 5)
          return miss("mul-as-add", "たし算に なっているみたい",
            "× は かけ算だよ。3つの数を かけ合わせよう。",
            `${p.a}×${p.b}×5＝${p.answer}。`);
        return miss("three-calc", "とちゅうの 計算を 見直そう",
          `${p.a}×${p.b}×5 は、どの順に かけても 答えは同じ。`,
          `ぐう数と5を さきに かけると かんたん（例：${p.a % 2 === 0 ? `${p.a}×5＝${p.a * 5}` : `${p.b}×5＝${p.b * 5}`} → それに のこりを かける）。答えは ${p.answer}。`);
      }
      // 段が1つ分ずれた（数え間違い）
      if (ans === p.a * (p.b + 1) || ans === p.a * (p.b - 1))
        return miss("kuku-offby1", `${p.a}のだんが 1つ分 ずれているみたい`,
          `${p.a}×${p.b} は「${p.a}を ${p.b}回 たした数」だよ。1回 多いか少ないみたい。`,
          `${p.a}のだんを 小さい方から 声に出して 数え直そう。`);
      if (ans === p.b * (p.a + 1) || ans === p.b * (p.a - 1))
        return miss("kuku-offby1", `${p.b}のだんが 1つ分 ずれているみたい`,
          `かける数を まちがえていないかな。${p.a}×${p.b}＝${p.b}×${p.a} だよ。`,
          "どちらの段でも 答えは同じ。おぼえやすい段でたしかめよう。");
      // たし算してしまった
      if (ans === p.a + p.b)
        return miss("mul-as-add", "たし算に なっているみたい",
          `× は「かけ算」。${p.a}＋${p.b} ではなく、${p.a}を ${p.b}回 たすよ。`,
          "×は同じ数のまとまりが何個ぶんか、を表すよ。");
      return WRONG;
    },
  },

  /* ④わり算（あまりなし・あまりあり） -------------------------------- */
  {
    id: "div-rem",
    name: "わり算（あまり）",
    emoji: "🍰",
    group: "整数の計算",
    grade: "3年",
    answerType: "quorem",
    // 10問の構成（i=問題番号 0..9）:
    //   0-2 : 九九の範囲で 2けた÷1けた（あまりなし）
    //   3-5 : 99以下 ÷ 1けた（あまりあり）
    //   6-7 : 150以下の整数の 2けた÷2けた（あまりなし）
    //   8-9 : 150以下の整数の 2けた÷2けた（あまりあり）
    gen(i) {
      if (i == null) i = R(0, 9);
      let a, b, q, r;
      if (i < 3) {                       // 九九の範囲・2けた÷1けた・あまりなし
        do { b = R(2, 9); q = R(2, 9); a = b * q; } while (a < 10);
        r = 0;
      } else if (i < 6) {                // 99以下÷1けた・あまりあり
        b = R(2, 9);
        r = R(1, b - 1);
        q = R(1, Math.max(1, Math.floor((99 - r) / b)));
        a = b * q + r;
      } else if (i < 8) {                // 150以下・2けた÷2けた・あまりなし
        do { b = R(11, 30); q = R(2, Math.floor(150 / b)); a = b * q; } while (a > 150 || a < 10);
        r = 0;
      } else {                           // 150以下・2けた÷2けた・あまりあり
        do {
          b = R(11, 30);
          r = R(1, b - 1);
          q = R(1, Math.max(1, Math.floor((150 - r) / b)));
          a = b * q + r;
        } while (a > 150);
      }
      return { text: `${a} ÷ ${b}`, a, b, q, r, answer: { q, r } };
    },
    diagnose(ans, p) {
      if (ans.q === p.q && ans.r === p.r) return { correct: true };
      // あまりがわる数以上
      if (ans.r >= p.b)
        return miss("rem-too-big", "あまりが わる数より 大きいよ",
          `あまりは いつも わる数 ${p.b} より 小さくなるはず。もう1回 われないか たしかめよう。`,
          `あまりが ${p.b} 以上なら、商をもう1 大きくできるよ。`);
      // 商が1ずれ
      if (ans.q === p.q - 1 || ans.q === p.q + 1)
        return miss("quo-offby1", "商が 1つ ずれているみたい",
          `${p.b}×${ans.q} を計算して、もとの数 ${p.a} と くらべてみよう。`,
          `商×わる数＋あまり＝わられる数 になるか たしかめよう。`);
      // 検算不成立の一般エラー
      if (ans.q * p.b + ans.r !== p.a)
        return miss("check-fail", "たしかめ算が 合わないよ",
          `商×わる数＋あまり＝わられる数。${ans.q}×${p.b}＋${ans.r}＝${ans.q * p.b + ans.r} で、${p.a} にならないね。`,
          "この式にあてはめると、まちがいに気づきやすいよ。");
      return WRONG;
    },
  },

  /* ⑤2けた×1けたのかけ算 -------------------------------------------- */
  {
    id: "mul-2x1",
    name: "2けた × 1けた",
    emoji: "🎯",
    group: "整数の計算",
    grade: "3年",
    answerType: "int",
    gen() {
      const a = R(12, 99), b = R(3, 9);
      return { text: `${a} × ${b}`, a, b, answer: a * b };
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      const tens = Math.floor(p.a / 10), ones = p.a % 10;
      // くり上がりを足し忘れ（各位を独立にかけて並べた）
      const onesPart = ones * p.b;
      const carry = Math.floor(onesPart / 10);
      const noCarry = (tens * p.b) * 10 + (onesPart % 10);
      if (carry > 0 && ans === noCarry)
        return miss("carry-forget", "一のくらいの くり上がりを たし忘れているみたい",
          `${ones}×${p.b}＝${onesPart} の くり上がり ${carry} を、十のくらいの計算に たすのを 忘れていない？`,
          `十のくらいは ${tens}×${p.b}＋${carry} だよ。`);
      // 十の位のかけ算を忘れて一の位だけかけた
      if (ans === onesPart)
        return miss("tens-forget", "十のくらいを かけ忘れているみたい",
          `${p.a} の 十のくらい（${tens}0）にも ${p.b} をかけるよ。`,
          `${tens}0×${p.b}＝${tens * p.b * 10} と ${onesPart} を たそう。`);
      return WRONG;
    },
  },

  /* ⑥わり算の筆算 ---------------------------------------------------- */
  {
    id: "div-long",
    name: "わり算の 筆算",
    emoji: "📝",
    group: "整数の計算",
    grade: "4年",
    answerType: "quorem",
    // 必ず余りあり。0-4:わる数1けた・商99以下 / 5-9:わる数2けた・商99以下。
    gen(i) {
      if (i == null) i = R(0, 9);
      const b = i < 5 ? R(2, 9) : R(11, 99);   // わる数（1けた or 2けた）
      const q = R(10, 99);                     // 商は2けた（99以下）
      const r = R(1, b - 1);                   // あまりは必ず1以上
      const a = b * q + r;
      return { text: `${a} ÷ ${b}`, a, b, q, r, answer: { q, r } };
    },
    diagnose(ans, p) {
      if (ans.q === p.q && ans.r === p.r) return { correct: true };
      if (ans.r >= p.b)
        return miss("rem-too-big", "あまりが わる数より 大きいよ",
          `あまりは わる数 ${p.b} より小さくなるよ。`, "その位で もう1回 われないか確認しよう。");
      // 商に0を立て忘れ（けた数が1つ少ない）
      if (String(p.q).includes("0") && String(ans.q).length === String(p.q).length - 1)
        return miss("zero-skip", "商の 0 を 立て忘れているみたい",
          `途中で わられない位があるとき、その位には 0 を書くよ。0を とばすと けたが ずれてしまう。`,
          `${p.a}÷${p.b} の商は ${String(p.q).length}けた。0の位を とばしていないか確認しよう。`);
      if (ans.q * p.b + ans.r !== p.a)
        return miss("check-fail", "たしかめ算が 合わないよ",
          `${ans.q}×${p.b}＋${ans.r}＝${ans.q * p.b + ans.r}。もとの ${p.a} にならないよ。`,
          "商×わる数＋あまり＝わられる数 で見直そう。");
      return WRONG;
    },
  },

  /* ⑦小数のたし算・ひき算 -------------------------------------------- */
  {
    id: "dec-add-sub",
    name: "小数の たし算・ひき算",
    emoji: "💧",
    group: "小数",
    grade: "4年",
    answerType: "dec",
    gen() {
      // わざと けた数の違う小数を混ぜる（位ずれ・小数点ミスを誘発）
      const a = R(11, 89) / 10;                 // 1.1〜8.9
      const b = Math.random() < 0.5 ? R(11, 89) / 10 : R(105, 289) / 100; // 小数第1位 or 第2位
      if (Math.random() < 0.5) {
        const ans = Math.round((a + b) * 100) / 100;
        return { text: `${a} + ${b}`, a, b, op: "+", answer: ans };
      } else {
        let x = a, y = b;
        if (y > x) [x, y] = [y, x];
        const ans = Math.round((x - y) * 100) / 100;
        return { text: `${x} − ${y}`, a: x, b: y, op: "-", answer: ans };
      }
    },
    diagnose(ans, p) {
      if (Math.abs(ans - p.answer) < 1e-9) return { correct: true };
      // 小数点を無視して、末尾ぞろえ（右づめ）で計算したとき起きやすい値
      const dpA = decimals(p.a), dpB = decimals(p.b), md = Math.max(dpA, dpB);
      const ai = Math.round(p.a * 10 ** dpA), bi = Math.round(p.b * 10 ** dpB);
      // 末尾ぞろえ誤り：小数第◯位が違うのに右にそろえて足し引き
      if (dpA !== dpB) {
        const wrongTail = p.op === "+"
          ? (ai + bi) / 10 ** Math.max(dpA, dpB) // ざっくり右づめ
          : (Math.max(ai, bi) - Math.min(ai, bi)) / 10 ** Math.max(dpA, dpB);
        // ここは近似判定：位をそろえずに計算した匂いがする
        return miss("decimal-align", "小数点の 位を そろえて 計算しよう",
          `${p.a} と ${p.b} は 小数のけた数がちがうね。右づめではなく、小数点を たてにそろえて計算するよ。`,
          "たりない位は 0 をおぎなうと そろえやすい（例 2.5 → 2.50）。");
      }
      return miss("decimal-point", "小数点の 打ち方を 見直そう",
        "答えの小数点の位置が ずれているかも。位をそろえて、小数点は まっすぐ下におろそう。",
        "計算のあと、だいたいの大きさ（見つもり）と くらべると気づけるよ。");
    },
  },

  /* ⑧小数のかけ算・わり算 -------------------------------------------- */
  {
    id: "dec-mul-div",
    name: "小数の かけ算・わり算",
    emoji: "🌊",
    group: "小数",
    grade: "5年",
    answerType: "dec",
    // 10問の構成（i=問題番号 0..9）:
    //   0-5 : 小数 ÷ 整数（6問）    6-9 : 小数 ÷ 小数（4問）
    gen(i) {
      if (i == null) i = R(0, 9);
      if (i < 6) {                       // 小数 ÷ 整数（割り切れる・わられる数は必ず小数）
        let b, q, a, t = 0;
        do { b = R(2, 9); q = R(11, 49) / 10; a = round2(b * q); t++; }
        while (Number.isInteger(a) && t < 30);
        return { text: `${a} ÷ ${b}`, a, b, op: "÷", kind: "dec-int", answer: round2(a / b) };
      } else {                           // 小数 ÷ 小数（割り切れる・わられる数も小数）
        let bdec, q, a, t = 0;
        do { bdec = pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.2, 1.5, 2.5]); q = R(2, 9); a = round2(bdec * q); t++; }
        while (Number.isInteger(a) && t < 30);
        return { text: `${a} ÷ ${bdec}`, a, b: bdec, op: "÷", kind: "dec-dec", answer: q };
      }
    },
    diagnose(ans, p) {
      if (Math.abs(ans - p.answer) < 1e-9) return { correct: true };
      // 小数点の位置ミス（10倍／1/10ずれ）
      if (Math.abs(ans - p.answer * 10) < 1e-9 || Math.abs(ans - p.answer / 10) < 1e-9)
        return miss("decimal-place", "小数点の 位置が ずれているみたい",
          p.kind === "dec-dec"
            ? `小数でわるときは、わる数を 整数にするよ。${p.b} を ${decShift(p.b)}倍して整数にしたら、わられる数 ${p.a} も 同じだけ ずらして計算しよう。`
            : `わる数が 整数のときは、わられる数の 小数点を そのまま 天国（商）に 上げるよ。`,
          "整数として計算 → 最後に小数点の位置を決める、の順で考えよう。");
      return WRONG;
    },
  },

  /* ㉓いろんな単位（小数あり） ―― 長さ・重さ・かさ・面積の単位換算 ---- */
  {
    id: "unit-convert",
    name: "いろんな単位（小数あり）",
    emoji: "📏",
    group: "小数",
    grade: "6年",
    answerType: "dec",
    // 10問の構成（i=問題番号 0..9）:
    //   0-1 長さ / 2-3 重さ / 4-6 かさ / 7-9 面積
    //   [大きい単位, 小さい単位, 倍率F]。F は必ず10の倍数（＝0の数だけ位がずれる）。
    gen(i) {
      if (i == null) i = R(0, 9);
      let category, pairs;
      if (i <= 1) {
        category = "length";
        pairs = [["cm", "mm", 10], ["m", "cm", 100], ["m", "mm", 1000], ["km", "m", 1000]];
      } else if (i <= 3) {
        category = "weight";
        pairs = [["g", "mg", 1000], ["kg", "g", 1000], ["t", "kg", 1000]];
      } else if (i <= 6) {
        category = "volume";
        pairs = [["dL", "mL", 100], ["L", "dL", 10], ["L", "mL", 1000], ["kL", "L", 1000]];
      } else {
        category = "area";
        pairs = [["m²", "cm²", 10000], ["a", "m²", 100], ["ha", "a", 100], ["ha", "m²", 10000], ["km²", "ha", 100]];
      }
      const [big, small, F] = pick(pairs);
      // 大きい単位での値 v（整数／小数第1位／第2位）。かけ算しかしないので
      // 小さい単位での値も v の桁数以下 → 答えも必ず小数第2位までに収まる。
      const v = round2(niceUnitVal());
      const bigVal = v;
      const smallVal = round2(v * F);
      if (Math.random() < 0.5) {
        // 大 → 小（数は大きくなる：×F）
        return { text: `${bigVal}${big}`, unit: small, category, big, small, F, src: bigVal, op: "mul", answer: smallVal };
      }
      // 小 → 大（数は小さくなる：÷F）
      return { text: `${smallVal}${small}`, unit: big, category, big, small, F, src: smallVal, op: "div", answer: bigVal };
    },
    diagnose(ans, p) {
      const close = (x, y) => Math.abs(x - y) < 5e-4;
      if (close(ans, p.answer)) return { correct: true };
      const zeros = String(p.F).length - 1; // F の 0 の数

      // 面積は「辺の長さの倍率」を そのまま使ってしまう誤り（1m=100cm → 1㎡=100倍？）
      if (p.category === "area") {
        const lin = Math.round(Math.sqrt(p.F));
        if (lin * lin === p.F) {
          const areaWrong = p.op === "mul" ? round2(p.src * lin) : round2(p.src / lin);
          if (close(ans, areaWrong))
            return miss("area-square", "面積は 辺を 2回 かえるよ",
              `辺の長さは ${lin}倍でも、面積は たてと よこの 両方が かわるから ${lin}×${lin}＝${p.F}倍だよ。`,
              "「２乗の単位（㎠・㎡…）」は 倍率も ２乗する。1m＝100cm でも 1㎡＝10000㎠。");
        }
      }

      // かける・わるが 反対（大小の向きをまちがえた）
      const rev = p.op === "mul" ? p.src / p.F : p.src * p.F;
      if (close(ans, rev))
        return miss("convert-reverse", "かける・わるが 反対かも",
          p.op === "mul"
            ? `大きい単位（${p.big}）から 小さい単位（${p.small}）に 直すと、数は 大きくなるよ（×${p.F}）。`
            : `小さい単位（${p.small}）から 大きい単位（${p.big}）に 直すと、数は 小さくなるよ（÷${p.F}）。`,
          "「単位が 小さいほど 数は 大きい」を 目じるしに、×か÷かを 決めよう。");

      // 0 の数（位）のとりちがえ：×10・×100…や ÷10・÷100…でずれた
      for (const k of [10, 100, 1000, 0.1, 0.01, 0.001]) {
        if (close(ans, round2(p.answer * k)))
          return miss("unit-zeros", "0の数（位）を まちがえたみたい",
            `${p.big} と ${p.small} の 間は ${p.F}倍（0が ${zeros}こ）だよ。0の数を 数え直そう。`,
            "1000倍なら 小数点は 右に3つ、÷1000なら 左に3つ 動くよ。");
      }
      return WRONG;
    },
  },

  /* ⑨分数のたし算・ひき算（同分母） --------------------------------- */
  {
    id: "frac-same",
    name: "分数の たし算・ひき算（同分母）",
    emoji: "🍕",
    group: "分数",
    grade: "4年",
    answerType: "frac",
    gen() {
      const d = R(3, 9);
      if (Math.random() < 0.5) {
        const a = R(1, d - 1), b = R(1, d - 1);
        const [n, dd] = reduceFrac(a + b, d);
        return { text: `${a}/${d} + ${b}/${d}`, a, b, d, op: "+", answer: { n: a + b, d }, reduced: [n, dd] };
      } else {
        // ひき算：答えが0にならないよう 分子を x>y にする
        const x = R(2, d - 1), y = R(1, x - 1);
        const [n, dd] = reduceFrac(x - y, d);
        return { text: `${x}/${d} − ${y}/${d}`, a: x, b: y, d, op: "-", answer: { n: x - y, d }, reduced: [n, dd] };
      }
    },
    display(p) {
      return `${fr(p.a, p.d)} ${p.op === "+" ? "＋" : "−"} ${fr(p.b, p.d)} ＝`;
    },
    diagnose(ans, p) {
      const val = ans.d ? ans.n / ans.d : NaN;
      const target = p.answer.n / p.answer.d;
      if (Math.abs(val - target) < 1e-9) {
        // 大きさが合っていても、既約分数でなければ不正解にする
        const [rn, rd] = p.reduced;
        if (ans.n === rn && ans.d === rd) return { correct: true };
        return miss("not-reduced", "約分して 答えよう",
          `大きさは合っているよ。でも これ以上わり切れない形（既約分数）にしよう。`,
          `${ans.n}/${ans.d} は ${rn}/${rd} に 約分できるよ。`);
      }
      // 分母どうしも足した／引いた
      const badD = p.op === "+" ? p.d + p.d : p.d - p.d;
      if ((p.op === "+" && ans.n === p.a + p.b && ans.d === p.d + p.d))
        return miss("add-denominator", "分母は たさないよ",
          `同じ分母どうしなら、分子だけ たすよ。分母 ${p.d} は そのまま。`,
          `${p.a}/${p.d}＋${p.b}/${p.d}＝(${p.a}＋${p.b})/${p.d} だよ。`);
      return WRONG;
    },
  },

  /* ⑩ 約分 ----------------------------------------------------------- */
  {
    id: "reduce",
    name: "約分",
    emoji: "✂️",
    group: "分数",
    grade: "5年",
    answerType: "frac",
    // 約分できる真分数のみ。0-4:分母40以下 / 5-9:分母40以上99以下。
    gen(i) {
      if (i == null) i = R(0, 9);
      let d, k, rd, rn, n, t = 0;
      do {
        d = i < 5 ? R(4, 40) : R(40, 99);
        const facs = divisorsOver1(d).filter((f) => d / f >= 2); // 約分後の分母が2以上
        if (facs.length) {
          k = pick(facs); rd = d / k;
          do { rn = R(1, rd - 1); } while (gcd(rn, rd) !== 1);
          n = rn * k;
        } else { rd = 0; }
        t++;
      } while ((!rd || rd < 2 || gcd(n, d) === 1) && t < 80);
      return { text: `${n}/${d}`, n, d, answer: { n: rn, d: rd }, reduced: [rn, rd] };
    },
    display(p) { return `${fr(p.n, p.d)} ＝`; },
    diagnose(ans, p) {
      if (!ans.d) return WRONG;
      const [rn, rd] = p.reduced;
      if (ans.n === rn && ans.d === rd) return { correct: true };
      const g = gcd(p.n, p.d);
      // 分子だけ／分母だけ わった（大きさが変わる）
      if (ans.d === p.d && ans.n !== p.n)
        return miss("reduce-only-num", "分母も 同じ数で わろう",
          `約分は 分子と分母を 同じ数で わるよ。分母 ${p.d} が そのままになっていない？`,
          `${p.n} と ${p.d} を 最大公約数 ${g} でわると ${rn}/${rd}。`);
      if (ans.n === p.n && ans.d !== p.d)
        return miss("reduce-only-den", "分子も 同じ数で わろう",
          `分子 ${p.n} が そのままになっていない？ 分子と分母は 同じ数でわるよ。`,
          `${p.n}÷${g}＝${rn}、${p.d}÷${g}＝${rd}。`);
      // 大きさは合っているが、まだ約分できる
      if (Math.abs(ans.n / ans.d - p.n / p.d) < 1e-9)
        return miss("reduce-not-lowest", "まだ 約分できるよ",
          `大きさは合っているけど、まだ わり切れるよ。これ以上約分できない形（既約分数）にしよう。`,
          `最大公約数 ${g} で 一気にわると ${rn}/${rd} になるよ。`);
      return WRONG;
    },
  },

  /* ⑩ 通分 ----------------------------------------------------------- */
  {
    id: "common-denom",
    name: "通分",
    emoji: "🔗",
    group: "分数",
    grade: "5年",
    answerType: "twofrac",
    // 既約分数を2つ出題し、最小公倍数(L)にそろえる。10問の構成:
    //   0-2 : 両方16以下・片方の分母がもう片方の倍数（L=大きい方。1つだけ変換）
    //   3-6 : 両方16以下・L≤50・倍数関係でない（両方変換）
    //   7-9 : 分母12〜32・L≤96・倍数関係でない（両方変換）
    gen(i) {
      if (i == null) i = R(0, 9);
      let d1, d2, L, t = 0;
      if (i < 3) {                       // 倍数関係
        do {
          const small = R(2, 8), big = small * R(2, Math.floor(16 / small));
          if (Math.random() < 0.5) { d1 = small; d2 = big; } else { d1 = big; d2 = small; }
          L = lcm(d1, d2);
          t++;
        } while ((d1 === d2 || d1 > 16 || d2 > 16) && t < 300);
      } else if (i < 7) {                // 16以下・L≤50・両方変換
        do {
          d1 = R(2, 16); d2 = R(2, 16);
          L = lcm(d1, d2);
          t++;
        } while ((d1 === d2 || L > 50 || L === d1 || L === d2) && t < 500);
      } else {                           // 12〜32・L≤96・両方変換
        do {
          d1 = R(12, 32); d2 = R(12, 32);
          L = lcm(d1, d2);
          t++;
        } while ((d1 === d2 || L > 96 || L === d1 || L === d2) && t < 500);
      }
      // 既約の真分数（もとから約分できない）にする
      let a, b;
      do { a = R(1, d1 - 1); } while (gcd(a, d1) !== 1);
      do { b = R(1, d2 - 1); } while (gcd(b, d2) !== 1);
      return { text: `(${a}/${d1},${b}/${d2})`, a, b, d1, d2, L,
        answer: { n1: a * (L / d1), n2: b * (L / d2), d: L } };
    },
    display(p) {
      return `<span class="cd-paren">(</span> ${fr(p.a, p.d1)} <span class="cd-comma">,</span> ${fr(p.b, p.d2)} <span class="cd-paren">)</span> ＝`;
    },
    diagnose(ans, p) {
      if (!ans.d1 || !ans.d2) return WRONG;
      const A = p.answer;
      if (ans.d1 === A.d && ans.d2 === A.d && ans.n1 === A.n1 && ans.n2 === A.n2)
        return { correct: true };
      const v1 = Math.abs(ans.n1 / ans.d1 - p.a / p.d1) < 1e-9;
      const v2 = Math.abs(ans.n2 / ans.d2 - p.b / p.d2) < 1e-9;
      const m1 = p.L / p.d1, m2 = p.L / p.d2;
      // 分母がそろっていない／最小公倍数Lでない（大きさは合っている）
      if (v1 && v2 && (ans.d1 !== A.d || ans.d2 !== A.d))
        return miss("cd-wrong-denominator", `分母を 最小公倍数 ${p.L} に そろえよう`,
          `${p.d1} と ${p.d2} の 最小公倍数は ${p.L}。両方の分母を ${p.L} にそろえるよ。`,
          `${p.d1}→${p.L} は ${m1}倍、${p.d2}→${p.L} は ${m2}倍。分子も 同じ数だけ かけよう。`);
      // 分母はどちらもLだが分子が違う
      if (ans.d1 === A.d && ans.d2 === A.d)
        return miss("cd-wrong-numerator", "分子の かけ算を 見直そう",
          `分母を ${p.L} にするには、${p.d1} は ${m1}倍・${p.d2} は ${m2}倍。分子にも 同じ数を かけるよ。`,
          `${p.a}×${m1}＝${A.n1}、${p.b}×${m2}＝${A.n2}。答えは (${A.n1}/${p.L}, ${A.n2}/${p.L})。`);
      return WRONG;
    },
  },

  /* ⑪分数のかけ算・わり算 -------------------------------------------- */
  {
    id: "frac-mul-div",
    name: "分数の かけ算・わり算",
    emoji: "🧩",
    group: "分数",
    grade: "6年",
    answerType: "frac",
    gen() {
      const n1 = R(1, 5), d1 = R(2, 6), n2 = R(1, 5), d2 = R(2, 6);
      if (Math.random() < 0.5) {
        const [rn, rd] = reduceFrac(n1 * n2, d1 * d2);
        return { text: `${n1}/${d1} × ${n2}/${d2}`, n1, d1, n2, d2, op: "×", answer: { n: n1 * n2, d: d1 * d2 }, reduced: [rn, rd] };
      } else {
        const [rn, rd] = reduceFrac(n1 * d2, d1 * n2);
        return { text: `${n1}/${d1} ÷ ${n2}/${d2}`, n1, d1, n2, d2, op: "÷", answer: { n: n1 * d2, d: d1 * n2 }, reduced: [rn, rd] };
      }
    },
    display(p) {
      return `${fr(p.n1, p.d1)} ${p.op} ${fr(p.n2, p.d2)} ＝`;
    },
    diagnose(ans, p) {
      const val = ans.d ? ans.n / ans.d : NaN;
      const target = p.answer.n / p.answer.d;
      if (Math.abs(val - target) < 1e-9) {
        const [rn, rd] = p.reduced;
        if (ans.n === rn && ans.d === rd) return { correct: true };
        return miss("not-reduced", "約分して 答えよう",
          `大きさは合っているよ。でも これ以上わり切れない形（既約分数）にしよう。`,
          `${ans.n}/${ans.d} は ${rn}/${rd} に 約分できるよ。`);
      }
      if (p.op === "÷") {
        // わる数を逆数にしなかった（そのままかけた or 分子分母それぞれ割った）
        if (ans.n === p.n1 * p.n2 && ans.d === p.d1 * p.d2)
          return miss("no-reciprocal", "わる数を 逆数に して かけよう",
            `÷${p.n2}/${p.d2} は ×${p.d2}/${p.n2} に 直して 計算するよ。`,
            "分数のわり算は、÷の うしろだけ 分母と分子を 入れかえて かけるよ。そして 約分わすれに ちゅうい！");
      } else {
        // かけ算なのに通分してしまった等
        if (ans.d === lcm(p.d1, p.d2))
          return miss("mul-common-denom", "かけ算では 通分は いらないよ",
            "分数のかけ算は、分子どうし・分母どうしを そのまま かけるよ。通分は たし算・ひき算のときだけ。",
            `${p.n1}/${p.d1}×${p.n2}/${p.d2}＝(${p.n1}×${p.n2})/(${p.d1}×${p.d2}) だよ。`);
      }
      return WRONG;
    },
  },

  /* ⑫多角形と角度 ---------------------------------------------------- */
  {
    id: "angle",
    name: "多角形と 角度",
    emoji: "📐",
    group: "図形",
    grade: "5年",
    answerType: "int",
    gen() {
      const kinds = [
        { n: 3, name: "三角形" }, { n: 4, name: "四角形" },
        { n: 5, name: "五角形" }, { n: 6, name: "六角形" },
      ];
      const k = pick(kinds);
      const sum = (k.n - 2) * 180;
      if (Math.random() < 0.5) {
        return { text: `${k.name}の 内角の和は 何度？`, unit: "度", kind: "sum", n: k.n, name: k.name, answer: sum };
      } else {
        // 正多角形の1つの内角
        const one = sum / k.n;
        return { text: `正${k.name}の 1つの 内角は 何度？`, unit: "度", kind: "one", n: k.n, name: k.name, sum, answer: one };
      }
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.kind === "sum") {
        if (ans === p.n * 180)
          return miss("angle-formula", "公式は (n−2)×180 だよ",
            `${p.name}は 三角形 ${p.n - 2} 個に分けられるよ。だから 内角の和は (${p.n}−2)×180＝${(p.n - 2) * 180}度。`,
            "頂点から対角線を引いて、三角形が何個できるか数えてみよう。");
      } else {
        if (ans === p.sum)
          return miss("forgot-divide", "1つ分にするには 頂点の数で わろう",
            `それは 内角の「和」だよ。正${p.name}なら すべて等しいから、和 ${p.sum} を ${p.n} でわると1つ分。`,
            `${p.sum}÷${p.n}＝${p.sum / p.n}度。`);
      }
      return WRONG;
    },
    figure(p) { return figPolygon(p); },
  },

  /* ⑬長方形・正方形の面積 -------------------------------------------- */
  {
    id: "area-rect",
    name: "長方形・正方形の 面積",
    emoji: "🟦",
    group: "図形",
    grade: "4年",
    answerType: "int",
    // 10問の構成：
    //   0-3 : 長方形・正方形
    //   4-7 : すみを切り取ったL字の形
    //   8   : 正方形の中の 45°かたむいた正方形（各辺の中点を結ぶ）
    //   9   : 正方形の中の 45°かたむいた長方形
    gen(i) {
      if (i == null) i = R(0, 9);
      if (i < 4) {
        if (Math.random() < 0.5) {
          const a = R(3, 15), b = R(3, 15);
          return { text: `たて ${a}cm、よこ ${b}cm の長方形の 面積は？`, unit: "cm²", a, b, kind: "rect", answer: a * b };
        } else {
          const a = R(3, 15);
          return { text: `1辺 ${a}cm の正方形の 面積は？`, unit: "cm²", a, kind: "square", answer: a * a };
        }
      }
      if (i < 8) {
        // すみから小さな長方形（または正方形）を切り取った形
        let W = R(9, 16), H = R(7, 13);
        while (W === H) H = R(7, 13);   // 外側は必ず長方形にする
        let w = R(3, Math.min(7, W - 3)), h = R(2, Math.min(5, H - 3));
        if (Math.random() < 0.5) { const t = Math.min(w, h); w = t; h = t; }   // 正方形の切り取り
        const shape = w === h ? "正方形" : "長方形";
        return {
          text: `たて${H}cm・よこ${W}cm の長方形から、すみの たて${h}cm・よこ${w}cm の${shape}を 切り取りました。のこりの 面積は？`,
          unit: "cm²", kind: "lshape", W, H, w, h, answer: W * H - w * h,
        };
      }
      if (i === 8) {
        // 各辺の中点を結んでできる、45°かたむいた正方形
        const s = R(3, 10) * 2;   // 偶数にして答えを整数に
        return {
          text: `1辺 ${s}cm の正方形の 各辺の まんなかを むすんでできた、かたむいた正方形の 面積は？`,
          unit: "cm²", kind: "tilt-square", s, answer: s * s / 2,
        };
      }
      // 正方形の中の 45°かたむいた長方形（頂点が各辺上にある）
      let s, b;
      do { s = R(4, 9) * 2; b = R(2, Math.floor(s / 2) - 1); } while (b * 2 === s);
      const a = s - b;
      return {
        text: `1辺 ${s}cm の正方形の中に 45°かたむいた長方形が あります。頂点は 各辺を ${b}cm と ${a}cm に 分けています。長方形の 面積は？`,
        unit: "cm²", kind: "tilt-rect", s, a, b, answer: 2 * a * b,
      };
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.kind === "lshape") {
        const whole = p.W * p.H, cut = p.w * p.h;
        if (ans === whole)
          return miss("lshape-whole", "切り取った 分を ひこう",
            `全体は ${p.W}×${p.H}＝${whole}cm²。切り取った ${p.w}×${p.h}＝${cut}cm² を ひくよ。`,
            `${whole}−${cut}＝${p.answer}cm²`);
        if (ans === cut)
          return miss("lshape-cut", "それは 切り取った 部分の面積だよ",
            `もとめるのは のこった形の面積。全体から 切り取った分を ひこう。`,
            `${whole}−${cut}＝${p.answer}cm²`);
        if (ans === whole + cut)
          return miss("lshape-add", "たすのでは なく ひくよ",
            `切り取った分は なくなっているから、全体から ひくよ。`,
            `${whole}−${cut}＝${p.answer}cm²`);
        return miss("lshape-split", "2つの長方形に 分けて 考えよう",
          `全体から 切り取った分を ひくか、L字を 2つの長方形に 分けて たすよ。`,
          `${p.W}×${p.H}−${p.w}×${p.h}＝${p.answer}cm²`);
      }
      if (p.kind === "tilt-square") {
        const whole = p.s * p.s;
        if (ans === whole)
          return miss("tilt-whole", "それは 外がわの正方形の面積だよ",
            `中の かたむいた正方形は、外の 正方形の ちょうど 半分。`,
            `${p.s}×${p.s}÷2＝${p.answer}cm²`);
        if (ans === whole / 4)
          return miss("tilt-quarter", "4分の1では なく 半分だよ",
            `4すみの 三角形を 4つ 合わせると 外の正方形の 半分。のこりが 中の正方形。`,
            `${p.s}×${p.s}÷2＝${p.answer}cm²`);
        return miss("tilt-half", "4すみの 三角形を ひいて 考えよう",
          `4すみの 直角三角形は 1つ ${p.s / 2}×${p.s / 2}÷2＝${p.s * p.s / 8}cm²。4つで ${whole / 2}cm²。`,
          `${whole}−${whole / 2}＝${p.answer}cm²（外の 半分）`);
      }
      if (p.kind === "tilt-rect") {
        const whole = p.s * p.s, corners = p.a * p.a + p.b * p.b;
        if (ans === whole)
          return miss("tilt-whole", "それは 外がわの正方形の面積だよ",
            `4すみの 直角三角形を ひくと 中の長方形に なるよ。`,
            `${whole}−(${p.a}×${p.a}＋${p.b}×${p.b})＝${p.answer}cm²`);
        if (ans === p.a * p.b)
          return miss("tilt-rect-double", `面積は ${p.a}×${p.b} の 2ばいに なるよ`,
            `4すみの三角形を ひくと ${whole}−${corners}＝${p.answer}cm²。これは ${p.a}×${p.b}の2ばい。`,
            `かたむいた長方形の たてと よこは ななめの 長さだから、${p.a}×${p.b} そのものでは ないよ。`);
        if (ans === whole - corners / 2)
          return miss("tilt-rect-corner", "4すみ 全部を ひこう",
            `4すみの三角形は 合わせて ${p.a}×${p.a}＋${p.b}×${p.b}＝${corners}cm²。`,
            `${whole}−${corners}＝${p.answer}cm²`);
        return miss("tilt-rect-corner", "4すみの 三角形を ひいて 求めよう",
          `すみの三角形は ${p.b}と${p.b} の直角三角形が2つ、${p.a}と${p.a} の直角三角形が2つ。合わせて ${corners}cm²。`,
          `${whole}−${corners}＝${p.answer}cm²`);
      }
      if (p.kind === "rect") {
        if (ans === 2 * (p.a + p.b))
          return miss("area-vs-perimeter", "それは まわりの長さ（周）だよ",
            `面積は たて×よこ。${p.a}×${p.b}＝${p.a * p.b}cm²。たてとよこを たすのは まわりの長さ。`,
            "面積は「広さ」、1cm²のマスが何個あるか、と考えよう。");
        if (ans === p.a + p.b)
          return miss("area-add", "面積は たし算では 求められないよ",
            `たて×よこ で計算するよ。${p.a}×${p.b}＝${p.a * p.b}cm²。`,
            "マスの数＝たての数×よこの数 だね。");
      } else {
        if (ans === 4 * p.a)
          return miss("area-vs-perimeter", "それは まわりの長さだよ",
            `正方形の面積は 1辺×1辺。${p.a}×${p.a}＝${p.a * p.a}cm²。`,
            "4辺の合計（1辺×4）は まわりの長さだよ。");
        if (ans === 2 * p.a)
          return miss("area-add", "面積は 1辺×1辺 だよ",
            `${p.a}×${p.a}＝${p.a * p.a}cm²。`, "同じ数を2回かけるよ。");
      }
      return WRONG;
    },
    figure(p) {
      if (p.kind === "lshape") return figLShape(p);
      if (p.kind === "tilt-square") return figTiltSquare(p);
      if (p.kind === "tilt-rect") return figTiltRect(p);
      return figRect(p);
    },
  },

  /* ⑭三角形の面積 ---------------------------------------------------- */
  {
    id: "area-triangle",
    name: "三角形の 面積",
    emoji: "🔺",
    group: "図形",
    grade: "5年",
    answerType: "dec",
    gen() {
      const base = R(3, 16), h = R(3, 14);
      const ans = (base * h) / 2;
      return { text: `底辺 ${base}cm、高さ ${h}cm の三角形の 面積は？`, unit: "cm²", base, h, answer: ans };
    },
    diagnose(ans, p) {
      if (Math.abs(ans - p.answer) < 1e-9) return { correct: true };
      if (ans === p.base * p.h)
        return miss("forgot-half", "÷2 を わすれているみたい",
          `三角形の面積は 底辺×高さ÷2。${p.base}×${p.h}＝${p.base * p.h}、これを2でわって ${p.answer}cm²。`,
          "同じ三角形を もう1つ 180°まわして くっつけると 平行四辺形に なるよ。その 半分だから ÷2。");
      return WRONG;
    },
    figure(p) { return figTriangle(p); },
  },

  /* ⑮台形・平行四辺形の面積 ------------------------------------------ */
  {
    id: "area-trapezoid",
    name: "台形・平行四辺形の 面積",
    emoji: "🔷",
    group: "図形",
    grade: "5年",
    answerType: "dec",
    gen() {
      if (Math.random() < 0.5) {
        const a = R(3, 10), b = R(3, 10), h = R(3, 12);
        const ans = ((a + b) * h) / 2;
        return { text: `上底 ${a}cm、下底 ${b}cm、高さ ${h}cm の台形の 面積は？`, unit: "cm²", kind: "trapezoid", a, b, h, answer: ans };
      } else {
        const base = R(3, 14), h = R(3, 12);
        return { text: `底辺 ${base}cm、高さ ${h}cm の平行四辺形の 面積は？`, unit: "cm²", kind: "para", base, h, answer: base * h };
      }
    },
    diagnose(ans, p) {
      if (Math.abs(ans - p.answer) < 1e-9) return { correct: true };
      if (p.kind === "trapezoid") {
        if (ans === (p.a + p.b) * p.h)
          return miss("forgot-half", "台形は ÷2 が いるよ",
            `(上底＋下底)×高さ÷2。(${p.a}＋${p.b})×${p.h}＝${(p.a + p.b) * p.h}、÷2で ${p.answer}cm²。`,
            "同じ台形を もう1つ 180°まわして くっつけると、(上底＋下底) を 底辺 とする 平行四辺形に なるよ。その 半分だから ÷2。");
        if (ans === (p.a * p.b * p.h) / 2 || ans === p.a * p.b)
          return miss("trapezoid-formula", "上底と下底は「たす」よ",
            `かけるのではなく、(上底＋下底) を先にたしてから 高さをかけて ÷2 するよ。`,
            `(${p.a}＋${p.b})×${p.h}÷2＝${p.answer}cm²。`);
      } else {
        if (ans === (p.base * p.h) / 2)
          return miss("extra-half", "平行四辺形は ÷2 しないよ",
            `平行四辺形の面積は 底辺×高さ。${p.base}×${p.h}＝${p.base * p.h}cm²。÷2するのは三角形と台形だよ。`,
            "はしの 三角形を 切って 反対がわに 移すと 長方形に なるよ。広さは 変わらないから そのまま 底辺×高さ。");
      }
      return WRONG;
    },
    figure(p) { return p.kind === "trapezoid" ? figTrapezoid(p) : figParallelogram(p); },
  },

  /* ⑯円とおうぎ形の周と面積 ------------------------------------------ */
  {
    id: "circle",
    name: "円と おうぎ形",
    emoji: "⭕",
    group: "図形",
    grade: "6年",
    answerType: "dec",
    gen() {
      const r = R(2, 10);
      const roll = Math.random();
      if (roll < 0.28) {
        // 円の面積 πr²
        return { text: `半径 ${r}cm の円の 面積は？（円周率3.14）`, unit: "cm²", kind: "area", r, answer: round2(r * r * 3.14) };
      } else if (roll < 0.5) {
        // 円周 2πr
        return { text: `半径 ${r}cm の円の 円周は？（円周率3.14）`, unit: "cm", kind: "circ", r, answer: round2(2 * r * 3.14) };
      } else if (roll < 0.75) {
        // おうぎ形の面積
        const deg = pick([30, 45, 60, 90, 120, 135, 180, 240, 270]);
        return { text: `半径 ${r}cm、中心角 ${deg}° の おうぎ形の 面積は？（円周率3.14）`, unit: "cm²", kind: "sector-area", r, deg, answer: round2(r * r * 3.14 * deg / 360) };
      } else {
        // おうぎ形の弧の長さ
        const deg = pick([30, 45, 60, 90, 120, 135, 180, 240, 270]);
        return { text: `半径 ${r}cm、中心角 ${deg}° の おうぎ形の 弧の長さは？（円周率3.14）`, unit: "cm", kind: "sector-arc", r, deg, answer: round2(2 * r * 3.14 * deg / 360) };
      }
    },
    diagnose(ans, p) {
      if (Math.abs(ans - p.answer) < 1e-9) return { correct: true };
      const near = (x) => Math.abs(ans - x) < 1e-6;
      if (p.kind === "area") {
        if (near(2 * p.r * 3.14))
          return miss("area-vs-circumference", "それは 円周（まわり）の式だよ",
            `円の面積は 半径×半径×3.14。${p.r}×${p.r}×3.14＝${p.answer}cm²。`,
            "面積は 半径を2回かける、円周は 直径×3.14。区別しよう。");
        if (near((2 * p.r) * (2 * p.r) * 3.14))
          return miss("radius-diameter", "半径と 直径を まちがえていない？",
            `面積は「半径」×半径×3.14。半径は ${p.r}cm だよ。`, "直径は半径の2倍。式に使うのは半径。");
      } else if (p.kind === "circ") {
        if (near(p.r * 3.14))
          return miss("radius-diameter", "円周は 直径×3.14 だよ",
            `直径＝半径×2＝${2 * p.r}cm。円周は ${2 * p.r}×3.14＝${p.answer}cm。半径のままかけていない？`,
            "円周＝直径×円周率。半径なら 2×半径×3.14。");
        if (near(p.r * p.r * 3.14))
          return miss("area-vs-circumference", "それは 面積の式だよ",
            `円周は まわりの長さ。直径×3.14＝${p.answer}cm。半径を2回かけるのは面積。`,
            "まわりの長さ→直径×3.14、広さ→半径×半径×3.14。");
      } else if (p.kind === "sector-area") {
        if (near(p.r * p.r * 3.14))
          return miss("sector-fraction", `中心角の分（${p.deg}/360）を かけ忘れているみたい`,
            `おうぎ形は 円全体の ${p.deg}/360 だよ。半径×半径×3.14×${p.deg}/360＝${p.answer}cm²。`,
            "まず円全体の面積を出して、中心角÷360 をかけよう。");
        if (near(2 * p.r * 3.14 * p.deg / 360))
          return miss("area-vs-arc", "それは 弧の長さの式だよ",
            `おうぎ形の面積は 半径×半径×3.14×${p.deg}/360＝${p.answer}cm²。`,
            "面積は半径を2回かける。弧の長さは 円周×中心角/360。");
      } else { // sector-arc
        if (near(2 * p.r * 3.14))
          return miss("sector-fraction", `中心角の分（${p.deg}/360）を かけ忘れているみたい`,
            `弧の長さは 円周の ${p.deg}/360 だよ。2×${p.r}×3.14×${p.deg}/360＝${p.answer}cm。`,
            "まず円周を出して、中心角÷360 をかけよう。");
        if (near(p.r * p.r * 3.14 * p.deg / 360))
          return miss("area-vs-arc", "それは 面積の式だよ",
            `弧の長さは 2×半径×3.14×${p.deg}/360＝${p.answer}cm。`,
            "弧は「長さ」だから 円周から、面積は「広さ」だから 半径×半径から 求めるよ。");
      }
      return WRONG;
    },
    figure(p) { return (p.kind === "area" || p.kind === "circ") ? figCircle(p) : figSector(p); },
  },

  /* ⑰直方体と立方体の体積・表面積 ------------------------------------ */
  {
    id: "volume",
    name: "直方体・立方体の 体積・表面積",
    emoji: "📦",
    group: "図形",
    grade: "6年",
    answerType: "int",
    gen() {
      if (Math.random() < 0.6) {
        const a = R(2, 8), b = R(2, 8), c = R(2, 8);
        return { text: `たて${a}cm・よこ${b}cm・高さ${c}cm の直方体の 体積は？`, unit: "cm³", kind: "vol", a, b, c, answer: a * b * c };
      } else {
        const a = R(2, 8), b = R(2, 8), c = R(2, 8);
        const sa = 2 * (a * b + b * c + a * c);
        return { text: `たて${a}cm・よこ${b}cm・高さ${c}cm の直方体の 表面積は？`, unit: "cm²", kind: "surf", a, b, c, answer: sa };
      }
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.kind === "vol") {
        if (ans === 2 * (p.a * p.b + p.b * p.c + p.a * p.c))
          return miss("vol-vs-surface", "それは 表面積だよ",
            `体積は たて×よこ×高さ。${p.a}×${p.b}×${p.c}＝${p.answer}cm³。`,
            "体積は「中身のかさ」、表面積は「外側の面の合計」。単位も cm³ と cm²。");
        if (ans === p.a + p.b + p.c)
          return miss("vol-add", "体積は かけ算だよ",
            `たて×よこ×高さ で求めるよ。${p.a}×${p.b}×${p.c}＝${p.answer}cm³。`, "1cm³の立方体が何個ぶんか、で考えよう。");
      } else {
        if (ans === p.a * p.b * p.c)
          return miss("surface-vs-vol", "それは 体積だよ",
            `表面積は 6つの面の合計。2×(たて×よこ＋よこ×高さ＋たて×高さ)＝${p.answer}cm²。`,
            "向かい合う面は同じ広さ。3種類の面の面積を求めて2倍しよう。");
        if (ans === (p.a * p.b + p.b * p.c + p.a * p.c))
          return miss("surface-half", "面は 表と裏で 2枚ずつ あるよ",
            `3種類の面の合計を 2倍するよ。(${p.a * p.b}＋${p.b * p.c}＋${p.a * p.c})×2＝${p.answer}cm²。`,
            "直方体の面は全部で6面。向かい合う面が同じ広さで2枚ずつ。");
      }
      return WRONG;
    },
    figure(p) { return figCuboid(p); },
  },

  /* ⑱植木算 ---------------------------------------------------------- */
  {
    id: "trees",
    name: "植木算",
    emoji: "🌳",
    group: "文章題・割合",
    grade: "受験",
    answerType: "int",
    gen() {
      const gap = R(2, 8), n = R(4, 12), len = gap * n;
      const type = pick(["both", "circle"]);
      if (type === "both") {
        // 両端に木、木の本数
        return {
          text: `まっすぐな道に ${gap}mおきに 木を植えます。道の長さは ${len}mで、両端にも植えます。木は何本？`,
          unit: "本", kind: "both", gap, len, n, answer: n + 1,
        };
      } else {
        // 円の周りに植える → 本数=間隔の数
        return {
          text: `1周 ${len}mの 池のまわりに ${gap}mおきに 木を植えます。木は何本？`,
          unit: "本", kind: "circle", gap, len, n, answer: n,
        };
      }
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.kind === "both") {
        if (ans === p.n) // 間隔の数＝本数 と考えた
          return miss("tree-endpoint", "両端に植えるときは 間かくの数＋1本",
            `間かくは ${p.len}÷${p.gap}＝${p.n} 個。両端に木があるから、本数は 間かく＋1＝${p.n + 1}本。`,
            "短い例で確かめよう：長さ2mに1mおき→間かく2個、木は3本（●-●-●）。");
        if (ans === p.n - 1)
          return miss("tree-both-end", "両端の木を 数え落としているかも",
            `両端にも植えるよ。間かく ${p.n} 個の両はしに木があるので ${p.n + 1}本。`,
            "図をかいて、はしの木を忘れないようにしよう。");
      } else {
        if (ans === p.n + 1)
          return miss("tree-circle", "円（1周）のときは 間かくの数＝本数",
            `丸くつながっているから、始めと終わりの木が 同じ場所。だから ＋1 はしないよ。本数は ${p.n}本。`,
            "直線は「＋1」、円・池のまわりは「そのまま」。");
      }
      return WRONG;
    },
  },

  /* ⑲消去算 ---------------------------------------------------------- */
  {
    id: "elimination",
    name: "消去算",
    emoji: "🍩",
    group: "文章題・割合",
    grade: "受験",
    answerType: "int",
    gen() {
      // りんご a個 + みかん b個 = P円 ,  りんご a個 + みかん (b+k)個 = Q円  → みかん1個
      const apple = R(50, 120), orange = R(30, 90);
      const a = R(1, 3), b = R(1, 3), k = R(1, 3);
      const P = a * apple + b * orange;
      const Q = a * apple + (b + k) * orange; // みかんだけ k個増
      return {
        text: `りんご${a}個とみかん${b}個で${P}円。りんご${a}個とみかん${b + k}個で${Q}円。みかん1個は何円？`,
        unit: "円", apple, orange, a, b, k, P, Q, answer: orange,
      };
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      // 差をとらずに割った等
      if (ans === (p.Q - p.P))
        return miss("elim-diff", "差は 「みかん◯個ぶん」だよ。まだ割っていない",
          `2つの式のちがいは みかん ${p.k}個。ねだんの差 ${p.Q - p.P}円 は みかん${p.k}個ぶんだから、÷${p.k} しよう。`,
          `(${p.Q}−${p.P})÷${p.k}＝${(p.Q - p.P) / p.k}円 が みかん1個。`);
      if (ans === p.apple)
        return miss("elim-wrong-target", "求めるのは みかんの ねだんだよ",
          `2式の差からは「みかん」が求まるよ。同じ りんご${p.a}個 が消えるからね。`,
          "同じ数だけ入っている方（りんご）を消して、変化した方（みかん）を求めよう。");
      return WRONG;
    },
  },

  /* ⑳比の基本 -------------------------------------------------------- */
  {
    id: "ratio",
    name: "比の 基本",
    emoji: "⚖️",
    group: "文章題・割合",
    grade: "6年",
    answerType: "int",
    gen() {
      // a:b を簡単にする / 比例配分
      if (Math.random() < 0.5) {
        const g = R(2, 6), a = R(2, 6) * g, b = R(2, 6) * g;
        const [ra, rb] = reduceFrac(a, b);
        return { text: `${a} : ${b} を できるだけ簡単な比に。左の数はいくつ？`, kind: "simplify", a, b, ra, rb, answer: ra, unit: "" };
      } else {
        // 全体を a:b に分ける
        const ra = R(1, 4), rb = R(1, 4), unitv = R(3, 12);
        const total = (ra + rb) * unitv;
        return { text: `${total}個を ${ra}:${rb} に分けます。${ra}の方は何個？`, kind: "divide", ra, rb, total, answer: ra * unitv, unit: "個" };
      }
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.kind === "simplify") {
        return miss("ratio-gcd", "両方を 同じ数で わろう（最大公約数）",
          `${p.a}:${p.b} は 両方を 最大公約数でわると ${p.ra}:${p.rb}。片方だけ わっていない？`,
          "比は「両方を同じ数でかけたり割ったり」しても等しいよ。");
      } else {
        if (ans === Math.round(p.total * p.ra / (p.ra + p.rb)) && ans !== p.answer) {}
        if (ans === p.total / 2)
          return miss("ratio-half", "半分ずつでは ないよ",
            `全体を ${p.ra + p.rb} 等分して、そのうち ${p.ra} つ分だよ。`,
            `${p.total}÷(${p.ra}＋${p.rb})×${p.ra}＝${p.answer}個。`);
        return miss("ratio-parts", "全体を「比の合計」で わってから 何つ分か考えよう",
          `${p.ra}:${p.rb} の合計は ${p.ra + p.rb}。1つ分は ${p.total}÷${p.ra + p.rb}＝${p.total / (p.ra + p.rb)}個。それが ${p.ra} つ分。`,
          "「1つ分」を先に出すのがコツ。");
      }
      return WRONG;
    },
  },

  /* ㉑割合の基本 ------------------------------------------------------ */
  {
    id: "percentage",
    name: "割合の 基本",
    emoji: "💯",
    group: "文章題・割合",
    grade: "5年",
    answerType: "int",
    gen() {
      const base = R(2, 20) * 10;              // もとにする量
      const pct = pick([10, 20, 25, 30, 40, 50, 60, 75, 80]);
      if (Math.random() < 0.5) {
        // 比べる量を求める
        const ans = base * pct / 100;
        return { text: `${base}円の ${pct}% は 何円？`, kind: "compare", base, pct, answer: ans, unit: "円" };
      } else {
        // もとにする量を求める（比べる量と割合から）
        const cmp = base * pct / 100;
        return { text: `ある数の ${pct}% が ${cmp}円 でした。もとの数は？`, kind: "base", base, pct, cmp, answer: base, unit: "円" };
      }
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      if (p.kind === "compare") {
        if (ans === p.base * p.pct) // %を小数に直さずかけた
          return miss("percent-decimal", "％は 100でわって 小数にしてから かけよう",
            `${p.pct}% ＝ ${p.pct / 100}。${p.base}×${p.pct / 100}＝${p.answer}円。100でわり忘れていない？`,
            "50%＝0.5、25%＝0.25。まず割合を小数にするよ。");
        if (ans === Math.round(p.base / p.pct))
          return miss("percent-divide", "「◯%を求める」は かけ算だよ",
            `もとにする量 × 割合。${p.base}×${p.pct / 100}＝${p.answer}円。`,
            "くらべる量＝もとにする量×割合。");
      } else {
        if (ans === p.cmp * p.pct / 100)
          return miss("base-wrong-op", "もとにする量は わり算で 求めるよ",
            `くらべる量 ÷ 割合。${p.cmp}÷${p.pct / 100}＝${p.answer}円。かけていない？`,
            "「〜の◯%が△」の「〜」を求めるときは、△÷割合。");
        if (ans === p.cmp * p.pct)
          return miss("percent-decimal", "％を 小数に 直そう",
            `${p.pct}%＝${p.pct / 100}。もとの数＝${p.cmp}÷${p.pct / 100}＝${p.answer}円。`,
            "割合はまず小数に。そのあと わり算。");
      }
      return WRONG;
    },
  },

  /* ㉒速さの基本 ------------------------------------------------------ */
  {
    id: "speed",
    name: "速さの 基本",
    emoji: "🚗",
    group: "文章題・割合",
    grade: "5年",
    answerType: "int",
    gen() {
      const speed = R(3, 12), time = R(2, 9);
      const dist = speed * time;
      const kind = pick(["dist", "speed", "time"]);
      if (kind === "dist")
        return { text: `時速 ${speed}km で ${time}時間 進むと 何km？`, kind, speed, time, dist, answer: dist, unit: "km" };
      if (kind === "speed")
        return { text: `${dist}km を ${time}時間で 進みました。時速 何km？`, kind, speed, time, dist, answer: speed, unit: "km/時" };
      return { text: `時速 ${speed}km で ${dist}km 進むには 何時間？`, kind, speed, time, dist, answer: time, unit: "時間" };
    },
    diagnose(ans, p) {
      if (ans === p.answer) return { correct: true };
      // 速さ・時間・道のり の関係の取り違え
      if (p.kind === "dist" && ans === Math.round(p.speed / p.time))
        return miss("mihaji-dist", "道のり＝速さ × 時間 だよ",
          `時速 ${p.speed}km は「1時間で ${p.speed}km 進む」という意味。それが ${p.time}時間分だから かけ算だよ。`,
          `${p.speed}×${p.time}＝${p.dist}km。時間が ふえるほど 道のりは 長くなるね。`);
      if (p.kind === "speed" && (ans === p.dist * p.time))
        return miss("mihaji-speed", "速さ＝道のり ÷ 時間 だよ",
          `速さは「1時間あたりに 進む道のり」。${p.dist}kmを ${p.time}時間で 分けるから わり算だよ。`,
          `${p.dist}÷${p.time}＝${p.speed}。1時間分の道のりを 求めているんだね。`);
      if (p.kind === "time" && (ans === p.dist * p.speed))
        return miss("mihaji-time", "時間＝道のり ÷ 速さ だよ",
          `1時間で ${p.speed}km 進むとき、${p.dist}km の中に ${p.speed}km が いくつ分 あるかを 求めるよ。`,
          `${p.dist}÷${p.speed}＝${p.time}時間。`);
      return WRONG;
    },
  },
];

// 小数のけた数を数える
function decimals(x) {
  const s = String(x);
  return s.includes(".") ? s.split(".")[1].length : 0;
}
// その小数を整数にするための倍率（0.2→10, 1.25→100）
function decShift(x) { return 10 ** decimals(x); }

const round2 = (x) => Math.round(x * 100) / 100;

// 単位換算用の「大きい単位での値」：整数 or 小数第1位 or 小数第2位（0.1〜9.99）
function niceUnitVal() {
  const kind = pick(["int", "int", "d1", "d1", "d2"]);
  if (kind === "int") return R(1, 9);
  if (kind === "d1") { let x; do { x = R(1, 99) / 10; } while (Number.isInteger(x)); return round2(x); }
  let x; do { x = R(11, 999) / 100; } while (Number.isInteger(x)); return round2(x);
}

/* =====================================================================
   図形（SVG）ビルダー ― 問題の数値に近い図を描く
   ・fsh  … 図形の面   fsh2 … 側面/上面（うすい）
   ・fdim … 補助線（点線・高さや半径）  flbl … ラベル文字
   ===================================================================== */
function fsvg(inner, vb) {
  return `<svg viewBox="${vb || "0 0 260 170"}" class="fig-svg" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
function flbl(x, y, t, anchor) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="flbl" text-anchor="${anchor || "middle"}">${t}</text>`;
}
function fitScale(w, h, maxW, maxH) { return Math.min(maxW / w, maxH / h); }

// ⑫ 多角形
function figPolygon(p) {
  const n = p.n, cx = 130, cy = 90, rad = 60, start = -Math.PI / 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start + i * 2 * Math.PI / n;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  const poly = pts.map(q => q.map(v => v.toFixed(1)).join(",")).join(" ");
  let extra = "";
  if (p.kind === "sum") {
    for (let i = 2; i < n - 1; i++) // 頂点0から対角線 →(n-2)個の三角形
      extra += `<line x1="${pts[0][0].toFixed(1)}" y1="${pts[0][1].toFixed(1)}" x2="${pts[i][0].toFixed(1)}" y2="${pts[i][1].toFixed(1)}" class="fdim"/>`;
  } else {
    extra = flbl(pts[0][0], pts[0][1] + 20, "?°");
  }
  return fsvg(`<polygon points="${poly}" class="fsh"/>${extra}`);
}

// ⑬ 長方形・正方形
function figRect(p) {
  const W = p.kind === "square" ? p.a : p.b, H = p.a;
  const s = fitScale(W, H, 150, 96);
  const rw = W * s, rh = H * s, x = (260 - rw) / 2, y = 24;
  let inner = `<rect x="${x.toFixed(1)}" y="${y}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" class="fsh"/>`;
  if (p.kind === "square") {
    inner += flbl(x + rw / 2, y + rh + 20, `1辺 ${p.a}cm`);
  } else {
    inner += flbl(x + rw / 2, y + rh + 20, `よこ ${p.b}cm`);
    inner += flbl(x - 8, y + rh / 2 + 4, `たて${p.a}`, "end");
  }
  return fsvg(inner, "0 0 260 160");
}

// ⑬ すみを切り取った L字の形（切り取った部分は点線で示す）
function figLShape(p) {
  const sc = fitScale(p.W, p.H, 150, 92);
  const W = p.W * sc, H = p.H * sc, w = p.w * sc, h = p.h * sc;
  const x = (260 - W) / 2, y = 26;
  const pts = [
    [x, y], [x + W - w, y], [x + W - w, y + h],
    [x + W, y + h], [x + W, y + H], [x, y + H],
  ].map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");
  let inner = `<polygon points="${pts}" class="fsh"/>`;
  // 切り取った部分（点線）
  inner += `<rect x="${(x + W - w).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="fdim" fill="none"/>`;
  inner += flbl(x + W / 2, y + H + 20, `よこ ${p.W}cm`);
  inner += flbl(x - 8, y + H / 2 + 4, `たて${p.H}`, "end");
  inner += flbl(x + W - w / 2, y - 7, `${p.w}`);
  inner += flbl(x + W + 8, y + h / 2 + 4, `${p.h}`, "start");
  return fsvg(inner, "0 0 260 168");
}

// ⑬ 正方形の中の 45°かたむいた正方形（各辺の中点を結ぶ）
function figTiltSquare(p) {
  const S = 118, x = (260 - S) / 2, y = 22, m = S / 2;
  let inner = `<rect x="${x}" y="${y}" width="${S}" height="${S}" class="fsh2"/>`;
  inner += `<polygon points="${x + m},${y} ${x + S},${y + m} ${x + m},${y + S} ${x},${y + m}" class="fsh"/>`;
  // 中点であることを示す小さな印
  const tick = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="2.4" class="fdot"/>`;
  inner += tick(x + m, y) + tick(x + S, y + m) + tick(x + m, y + S) + tick(x, y + m);
  inner += flbl(x + S / 2, y + S + 20, `1辺 ${p.s}cm`);
  inner += flbl(x + m / 2, y - 7, `${p.s / 2}`);
  inner += flbl(x + m + m / 2, y - 7, `${p.s / 2}`);
  return fsvg(inner, "0 0 260 168");
}

// ⑬ 正方形の中の 45°かたむいた長方形（頂点が各辺を b:a に分ける）
function figTiltRect(p) {
  const S = 118, x = (260 - S) / 2, y = 22;
  const u = S / p.s, b = p.b * u, a = p.a * u;
  let inner = `<rect x="${x}" y="${y}" width="${S}" height="${S}" class="fsh2"/>`;
  // 数学座標(左下原点)→SVG座標に変換： (b,0)(s,a)(s-b,s)(0,b)
  const P = [[b, 0], [S, a], [S - b, S], [0, b]]
    .map(([mx, my]) => `${(x + mx).toFixed(1)},${(y + S - my).toFixed(1)}`).join(" ");
  inner += `<polygon points="${P}" class="fsh"/>`;
  const dot = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="2.4" class="fdot"/>`;
  inner += dot(x + b, y + S) + dot(x + S, y + S - a) + dot(x + S - b, y) + dot(x, y + S - b);
  inner += flbl(x + b / 2, y + S + 18, `${p.b}`);
  inner += flbl(x + b + (S - b) / 2, y + S + 18, `${p.a}`);
  inner += flbl(x + S / 2, y + S + 34, `1辺 ${p.s}cm`);
  return fsvg(inner, "0 0 260 182");
}

// ⑭ 三角形
function figTriangle(p) {
  const s = fitScale(p.base, p.h, 150, 92);
  const bw = p.base * s, hh = p.h * s, y0 = 22, baseY = y0 + hh, x0 = (260 - bw) / 2;
  const apexX = x0 + bw * 0.32;
  const tri = `${x0.toFixed(1)},${baseY.toFixed(1)} ${(x0 + bw).toFixed(1)},${baseY.toFixed(1)} ${apexX.toFixed(1)},${y0}`;
  let inner = `<polygon points="${tri}" class="fsh"/>`;
  inner += `<line x1="${apexX.toFixed(1)}" y1="${y0}" x2="${apexX.toFixed(1)}" y2="${baseY.toFixed(1)}" class="fdim"/>`;
  inner += flbl(apexX + 14, (y0 + baseY) / 2 + 4, `高さ${p.h}`, "start");
  inner += flbl(x0 + bw / 2, baseY + 20, `底辺 ${p.base}cm`);
  return fsvg(inner, "0 0 260 160");
}

// ⑮ 台形
function figTrapezoid(p) {
  const s = fitScale(Math.max(p.a, p.b), p.h, 148, 84);
  const tw = p.a * s, bw = p.b * s, hh = p.h * s, y0 = 26, yB = y0 + hh, x0 = (260 - bw) / 2;
  const topL = x0 + (bw - tw) / 2, topR = topL + tw;
  const pts = `${topL.toFixed(1)},${y0} ${topR.toFixed(1)},${y0} ${(x0 + bw).toFixed(1)},${yB.toFixed(1)} ${x0.toFixed(1)},${yB.toFixed(1)}`;
  let inner = `<polygon points="${pts}" class="fsh"/>`;
  inner += flbl((topL + topR) / 2, y0 - 8, `上底 ${p.a}cm`);
  inner += flbl(x0 + bw / 2, yB + 20, `下底 ${p.b}cm`);
  const hx = topL + 10;
  inner += `<line x1="${hx.toFixed(1)}" y1="${y0}" x2="${hx.toFixed(1)}" y2="${yB.toFixed(1)}" class="fdim"/>`;
  inner += flbl(hx + 14, (y0 + yB) / 2 + 4, `高さ${p.h}`, "start");
  return fsvg(inner, "0 0 260 160");
}

// ⑮ 平行四辺形
function figParallelogram(p) {
  const s = fitScale(p.base, p.h, 128, 84);
  const bw = p.base * s, hh = p.h * s, sk = Math.min(38, bw * 0.4), y0 = 26, yB = y0 + hh, x0 = (260 - bw - sk) / 2;
  const pts = `${(x0 + sk).toFixed(1)},${y0} ${(x0 + sk + bw).toFixed(1)},${y0} ${(x0 + bw).toFixed(1)},${yB.toFixed(1)} ${x0.toFixed(1)},${yB.toFixed(1)}`;
  let inner = `<polygon points="${pts}" class="fsh"/>`;
  inner += flbl(x0 + bw / 2 + sk / 2, yB + 20, `底辺 ${p.base}cm`);
  const hx = x0 + sk + 8;
  inner += `<line x1="${hx.toFixed(1)}" y1="${y0}" x2="${hx.toFixed(1)}" y2="${yB.toFixed(1)}" class="fdim"/>`;
  inner += flbl(hx + 14, (y0 + yB) / 2 + 4, `高さ${p.h}`, "start");
  return fsvg(inner, "0 0 260 160");
}

// ⑯ 円
function figCircle(p) {
  const cx = 130, cy = 82, rr = Math.min(20 + p.r * 6, 66);
  let inner = `<circle cx="${cx}" cy="${cy}" r="${rr}" class="fsh"/>`;
  inner += `<line x1="${cx}" y1="${cy}" x2="${cx + rr}" y2="${cy}" class="fdim"/>`;
  inner += `<circle cx="${cx}" cy="${cy}" r="2.5" class="fdot"/>`;
  inner += flbl(cx + rr / 2, cy - 6, `半径 ${p.r}cm`);
  return fsvg(inner, "0 0 260 172");
}

// ⑯ おうぎ形
function figSector(p) {
  const cx = 122, cy = 92, rr = Math.min(20 + p.r * 6, 72), deg = p.deg;
  const half = (deg / 2) * Math.PI / 180;
  const x0 = cx + rr * Math.cos(half), y0 = cy - rr * Math.sin(half);
  const x1 = cx + rr * Math.cos(-half), y1 = cy - rr * Math.sin(-half);
  const large = deg > 180 ? 1 : 0;
  const path = `M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rr} ${rr} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
  let inner = `<path d="${path}" class="fsh"/>`;
  inner += flbl((cx + x0) / 2 + 6, (cy + y0) / 2 - 4, `半径 ${p.r}cm`, "start");
  inner += flbl(cx + 22, cy + 4, `${deg}°`, "start");
  return fsvg(inner, "0 0 260 176");
}

// ⑰ 直方体
function figCuboid(p) {
  const s = fitScale(p.b, p.c, 120, 78);
  const w = p.b * s, h = p.c * s, d = Math.min(p.a * s, 42) * 0.7 + 12;
  const dx = d * 0.7, dy = -d * 0.7;
  const x = (260 - w - dx) / 2, y = 150 - h;
  let inner = "";
  inner += `<polygon points="${x.toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w + dx).toFixed(1)},${(y + dy).toFixed(1)} ${(x + dx).toFixed(1)},${(y + dy).toFixed(1)}" class="fsh2"/>`; // 上面
  inner += `<polygon points="${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + h).toFixed(1)} ${(x + w + dx).toFixed(1)},${(y + h + dy).toFixed(1)} ${(x + w + dx).toFixed(1)},${(y + dy).toFixed(1)}" class="fsh2"/>`; // 右面
  inner += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="fsh"/>`; // 前面
  inner += flbl(x + w / 2, y + h + 18, `よこ ${p.b}cm`);
  inner += flbl(x - 8, y + h / 2 + 4, `高さ${p.c}`, "end");
  inner += flbl(x + w + dx / 2 + 12, y + dy / 2 + 2, `たて${p.a}`, "start");
  return fsvg(inner, "0 0 260 168");
}

// グローバル公開
window.TOPICS = TOPICS;
window.fr = fr;
