// Vietnamese search preset: about 600 synthetic notes plus a golden set (17 categories, 320 queries; see queriesPer) in the
// eval format of obsidian-hybrid-search ({id, query, relevant_paths, partial_paths, category, notes}) and a
// sample lexicon at _ohs/lexicon.md. Every word is generated or hand-written for this preset; no real notes.
// The golden set is not inside the vault: with `answersOut` it is written to that file, as for personal-vault.
// Output depends on the data tables and on the order of rng calls below. Do not reorder them.
import { createRng } from '../lib/prng.mjs';

export const name = 'vi-search';
export const description = 'About 600 Vietnamese notes, a lexicon file and a golden set of 17 query categories (320 queries) for search evals.';
export const options = {
  seed: { default: 11, description: 'PRNG seed (filler text and note order only; the golden set does not depend on it)' },
  answersOut: { default: '', outside: true, description: 'write the golden set (JSON) to this file outside the vault' },
};

export const categories = [
  'vi-accented', 'vi-unaccented', 'vi-partial-accent', 'vi-tone-placement', 'vi-iy', 'vi-dd', 'vi-tone-precision',
  'vi-compound', 'vi-mixed-en', 'vi-semantic', 'vi-names', 'vi-telex', 'vi-typo', 'vi-synonym', 'vi-abbr', 'vi-alias', 'vi-snippet',
];

/** Queries per category: 15, plus the harder ones (vi-compound 15 of 0.11.0 and 5 of 0.12.0, the rest of 0.12.0). */
const EXTRA = { 'vi-compound': 20, 'vi-accented': 20, 'vi-iy': 5, 'vi-abbr': 5, 'vi-semantic': 5, 'vi-mixed-en': 5 };
export const queriesPer = (category) => 15 + (EXTRA[category] ?? 0);

// ---- query transforms ------------------------------------------------------------------------------------------

export const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFC');
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const nfc = (s) => s.normalize('NFC');

const TONE_KEY = { '̀': 'f', '́': 's', '̉': 'r', '̃': 'x', '̣': 'j' };
// Telex: circumflex doubles the vowel, breve and horn add w, đ is dd, the tone key ends the syllable.
export function telex(phrase) {
  return nfc(phrase).split(' ').map((word) => {
    let out = '', tone = '';
    for (const ch of word) {
      if (ch === 'đ') { out += 'dd'; continue; }
      if (ch === 'Đ') { out += 'Dd'; continue; }
      const [base, ...marks] = ch.normalize('NFD');
      let letters = base;
      for (const m of marks) {
        if (TONE_KEY[m]) tone = TONE_KEY[m];
        else if (m === '̂') letters = base + base.toLowerCase();
        else if (m === '̆' || m === '̛') letters = base + 'w';
      }
      out += letters;
    }
    return out + tone;
  }).join(' ');
}

// Unaccented, then swap the last two letters of the first two words that have at least 4 letters.
export function typo(phrase) {
  let left = 2;
  return strip(phrase).split(' ').map((w) => {
    if (left > 0 && w.length >= 4 && w.at(-1) !== w.at(-2)) { left--; return w.slice(0, -2) + w.at(-1) + w.at(-2); }
    return w;
  }).join(' ');
}

// First word keeps its marks, the rest loses them.
const partialAccent = (phrase) => { const [first, ...rest] = nfc(phrase).split(' '); return [first, ...rest.map(strip)].join(' '); };

// Old-style tone placement (hòa) to new-style (hoà), and back.
const NEW_STYLE = [['òa', 'oà'], ['óa', 'oá'], ['ỏa', 'oả'], ['õa', 'oã'], ['ọa', 'oạ'], ['ùy', 'uỳ'], ['úy', 'uý'], ['ủy', 'uỷ'], ['ũy', 'uỹ'], ['ụy', 'uỵ'], ['òe', 'oè'], ['óe', 'oé'], ['ỏe', 'oẻ'], ['õe', 'oẽ'], ['ọe', 'oẹ']];
const toNewStyle = (s) => NEW_STYLE.reduce((t, [a, b]) => t.replaceAll(a, b), nfc(s));
const toOldStyle = (s) => NEW_STYLE.reduce((t, [a, b]) => t.replaceAll(b, a), nfc(s));

// y to i spelling (kỹ to kĩ) and back, for the words in the table below.
const Y_TO_I = [['kỹ', 'kĩ'], ['mỹ', 'mĩ'], ['lý', 'lí'], ['quý', 'quí'], ['tỷ', 'tỉ'], ['kỷ', 'kỉ'], ['kỳ', 'kì'], ['ký', 'kí']];
const toI = (s) => Y_TO_I.reduce((t, [a, b]) => t.replaceAll(a, b), nfc(s));
const toY = (s) => Y_TO_I.reduce((t, [a, b]) => t.replaceAll(b, a), nfc(s));

// ---- data tables -------------------------------------------------------------------------------------------------

// Phrases for accented, unaccented, partial-accent, telex, typo and snippet queries (same 15 notes, no "đ").
const SET_A = [
  'giữ chân khách hàng', 'sắp xếp thời gian biểu', 'phương pháp học tập hiệu quả', 'chuẩn bị bữa sáng', 'hành trình khám phá núi rừng',
  'nghệ thuật thuyết trình', 'tối ưu quy trình làm việc', 'thói quen ngủ sớm dậy sớm', 'bí quyết chụp ảnh chân dung', 'chiến lược tiếp thị nội dung',
  'bảo mật tài khoản trực tuyến', 'cách trồng rau sạch tại nhà', 'lộ trình ôn thi tốt nghiệp', 'những lưu ý khi thuê nhà', 'phân tích số liệu doanh thu',
];
// Snippet queries: a middle slice of the SET_A phrase (without marks) that must appear with its marks in the snippet.
const SNIPPET_SLICE = [[1, 3], [1, 3], [1, 3], [0, 2], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3], [1, 3]];

// Clusters for vi-unaccented and vi-dd. Every note of a cluster has the same body apart from one key term (a dish, a street)
// and a neutral numbered title, so only the key term tells the notes apart. SQLite's unicode61 folds a mark only when it is
// the single mark of a letter: "ế", "ữ", "ợ" (shape mark plus tone) and "đ" never fold. The unaccented key terms are made of
// such syllables only, and every dd key term has a đ, so an unaccented query cannot reach its note through the lexical
// index. The first 15 terms of each list are queried; the last 10 are only distractors.
const UNACCENTED_TERMS = [
  'nước mắm', 'ốc nướng', 'ếch nấu', 'mướp hấp', 'bưởi hồng', 'sữa nếp', 'bắp nướng', 'mứt cốm', 'nếp cẩm', 'lẩu ếch',
  'rượu nếp', 'phở sườn', 'chuối nướng', 'mực nướng', 'cuốn nấm',
  'mầm hấp', 'hến hấp', 'ốc hấp', 'mứt sấu', 'cốt lẩu', 'bột nếp', 'nếp nướng', 'mực hấp', 'nấm nướng', 'sườn nướng',
];
const DD_TERMS = [
  'Đồng Khởi', 'Điện Biên Phủ', 'Đinh Tiên Hoàng', 'Đề Thám', 'Đội Cấn', 'Đào Duy Từ', 'Đặng Dung', 'Đoàn Thị Điểm', 'Độc Lập', 'Đại Cồ Việt',
  'Đê La Thành', 'Đông Các', 'Đỗ Quang', 'Đặng Tất', 'Đinh Công Tráng',
  'Đồng Nai', 'Đồng Xoài', 'Đặng Thai Mai', 'Đào Tấn', 'Đinh Bộ Lĩnh', 'Đỗ Hành', 'Đốc Ngữ', 'Đường Thành', 'Đặng Văn Ngữ', 'Đoàn Văn Bơ',
];

// Written with the y spelling; the query uses the i spelling for even indexes and the note uses the i spelling for odd ones.
const SET_IY = [
  'kỹ thuật nấu ăn', 'mỹ thuật ứng dụng', 'lý do chuyển việc', 'kinh nghiệm quý báu', 'tỷ lệ chuyển đổi',
  'kỷ luật bản thân', 'kỳ thi cuối năm', 'kỹ năng giao tiếp', 'địa lý Việt Nam', 'vật lý lớp mười',
  'chi phí hợp lý', 'quản lý rủi ro', 'tâm lý học hành vi', 'ký hiệu toán học', 'nguyên lý hoạt động',
];

// Written with the old style for even indexes and the new style for odd ones; the query uses the other style.
const SET_TP = [
  'hòa giải mâu thuẫn', 'hòa bình thế giới', 'hóa đơn điện tử', 'hóa học hữu cơ', 'thủy điện nhỏ',
  'thủy sản xuất khẩu', 'khỏe mạnh mỗi ngày', 'sức khỏe tinh thần', 'tòa nhà văn phòng', 'họa sĩ trẻ',
  'xóa sổ nợ cũ', 'hỏa hoạn tại chung cư', 'văn hóa doanh nghiệp', 'thủy tinh cường lực', 'chuyển hóa năng lượng',
];

// [query phrase, target title, other phrase, other title]: the other phrase differs from the query only by a tone mark.
const TONE_PAIRS = [
  ['bán hàng', 'Mẹo bán hàng online', 'bạn hàng', 'Bạn hàng lâu năm'],
  ['bản đồ', 'Bản đồ tư duy', 'bàn đồ', 'Bàn đồ gỗ nội thất'],
  ['chữa bệnh', 'Chữa bệnh bằng thảo dược', 'chứa bệnh', 'Phòng chứa bệnh phẩm'],
  ['nghỉ ngơi', 'Nghỉ ngơi sau ca đêm', 'nghĩ ngợi', 'Đừng nghĩ ngợi nhiều'],
  ['nấm rơm', 'Trồng nấm rơm', 'nắm rơm', 'Nắm rơm làm chổi'],
  ['đỗ xe', 'Chỗ đỗ xe gần ga', 'đổ xe', 'Tránh đổ xe giữa dốc'],
  ['sóng biển', 'Sóng biển lúc bình minh', 'sống biển', 'Sống biển đảo thời nay'],
  ['tính toán', 'Tính toán chi phí xây nhà', 'tỉnh toán', 'Ghi chú tỉnh toán lại'],
  ['mở cửa', 'Mở cửa sổ mỗi sáng', 'mỡ cửa', 'Bôi mỡ cửa cuốn'],
  ['giá cả', 'Giá cả tăng dần', 'giã cả', 'Giã cả nồi cua'],
  ['cải tiến', 'Cải tiến sản phẩm', 'cãi tiến', 'Cãi tiến độ với khách'],
  ['hỏi đáp', 'Hỏi đáp thường gặp', 'hồi đáp', 'Hồi đáp thư mời'],
  ['quả cam', 'Quả cam sành', 'quà cam', 'Quà cam kết tặng khách'],
  ['sách vở', 'Sách vở đầu năm', 'sạch vở', 'Giữ sạch vở ghi'],
  ['mua bán', 'Mua bán xe cũ', 'múa bán', 'Múa bán nguyệt'],
];

// [query compound, target title, neighbouring compound, neighbour title]: the neighbour shares one syllable. Titles do not
// contain either compound, so only the body tells the notes apart.
const COMPOUND_PAIRS = [
  ['kế toán', 'Sổ cái cuối tháng', 'toán học', 'Bài tập về nhà'],
  ['ngân hàng', 'Khoản vay mua nhà', 'hàng không', 'Chuyến bay đêm'],
  ['học sinh', 'Lớp mười hai', 'sinh học', 'Tiết thực hành'],
  ['giáo viên', 'Cô chủ nhiệm', 'viên chức', 'Đợt tuyển dụng'],
  ['thị trường', 'Giá nhà đất', 'trường học', 'Điểm trường vùng cao'],
  ['bệnh viện', 'Tuyến huyện', 'viện trợ', 'Gói nhân đạo'],
  ['thành phố', 'Ven biển', 'phố cổ', 'Buổi tối'],
  ['thể thao', 'Ngoài trời', 'thao tác', 'Sao chép dữ liệu'],
  ['xe máy', 'Chạy điện', 'máy bay', 'Gấp giấy'],
  ['lãi suất', 'Cho vay tiêu dùng', 'suất ăn', 'Bếp công nghiệp'],
  ['dịch vụ', 'Giao nhận nội thành', 'vụ án', 'Nổi tiếng một thời'],
  ['cà chua', 'Salad mùa hè', 'chua ngọt', 'Món xào'],
  ['nhà hàng', 'Thực đơn chay', 'hàng xóm', 'Chuyện cũ'],
  ['đầu tư', 'Vàng và bạc', 'tư vấn', 'Pháp lý nhà ở'],
  ['bản tin', 'Buổi sáng', 'tin đồn', 'Thất thiệt'],
];

// Harder vi-compound cases, none of them in the sample lexicon: [first syllable, second syllable, query form]. The target
// note has the compound once; three distractor notes have both syllables more often, reversed or apart, so a search that
// matches syllables without knowing the compound ranks a distractor first. Query forms: the compound, the compound
// without marks, the compound after a verb phrase that only the target note has.
const HARD_COMPOUNDS = [
  ['sân', 'bay', 'accented'], ['bảo', 'tàng', 'folded'], ['bóng', 'đá', 'context'], ['bàn', 'chải', 'accented'], ['cầu', 'thủ', 'folded'],
  ['hải', 'sản', 'context'], ['thời', 'tiết', 'accented'], ['quần', 'áo', 'folded'], ['bệnh', 'nhân', 'context'], ['trái', 'cây', 'accented'],
  ['cửa', 'hàng', 'folded'], ['thư', 'viện', 'context'], ['giày', 'dép', 'accented'], ['ca', 'sĩ', 'folded'], ['mùa', 'đông', 'context'],
];
const HARD_FILLER = [
  'Sáng nay trời mưa nhẹ nên mọi người đến muộn một chút.',
  'Cuối tuần cả nhà về quê thăm ông bà.',
  'Danh sách việc cần làm được cập nhật lại vào tối thứ hai.',
  'Ghi lại vài ý chính để tuần sau bàn tiếp.',
  'Chiều nay có cuộc họp ngắn ở phòng lớn.',
  'Mọi thứ diễn ra khá suôn sẻ, không có gì đáng lo.',
];

// [note title, query, note phrase that must exist]
const MIXED_EN = [
  ['Họp sprint planning đầu tuần', 'họp sprint planning', 'sprint planning'],
  ['Kế hoạch marketing quý bốn', 'plan tiếp thị quý bốn', 'kế hoạch marketing'],
  ['Báo cáo feedback của người dùng', 'feedback người dùng', 'feedback'],
  ['Review code trước khi merge', 'kiểm tra code trước khi merge', 'review code'],
  ['Deadline nộp hồ sơ visa', 'hạn chót nộp hồ sơ visa', 'deadline'],
  ['Workshop thiết kế sản phẩm', 'workshop sản phẩm', 'workshop'],
  ['File backup dữ liệu hằng tuần', 'sao lưu dữ liệu hằng tuần', 'backup'],
  ['Brainstorm ý tưởng khởi nghiệp', 'brainstorm khởi nghiệp', 'brainstorm'],
  ['Update phiên bản ứng dụng', 'cập nhật phiên bản app', 'update'],
  ['Landing page cho chiến dịch mới', 'trang đích cho chiến dịch mới', 'landing page'],
  ['Meeting với đối tác nước ngoài', 'cuộc họp với đối tác nước ngoài', 'meeting'],
  ['Checklist chuyển nhà', 'checklist chuyển nhà', 'checklist'],
  ['Podcast về tài chính cá nhân', 'podcast tài chính cá nhân', 'podcast'],
  ['Mentor hướng dẫn người mới', 'người cố vấn hướng dẫn người mới', 'mentor'],
  ['Workflow duyệt chi phí', 'workflow duyệt chi phí', 'workflow'],
];

// [title, body, query]: the query shares no content word with the note.
const SEMANTIC = [
  ['Tiết kiệm chi tiêu', 'Mỗi cuối tuần mình ngồi ghi lại các khoản chi, rồi đặt trần ngân sách cho từng nhóm. Việc cắt bớt khoản không cần thiết giúp quỹ dự phòng đầy dần. Mình chuyển một phần thu nhập sang tài khoản riêng ngay khi nhận.', 'mẹo cất giữ của cải đều đặn'],
  ['Mất ngủ về đêm', 'Mình nằm trằn trọc tới gần sáng mà mắt vẫn mở thao láo. Thử tắt màn hình sớm, uống nước ấm và hít thở chậm thì dễ chịu hơn. Giấc nghỉ chập chờn khiến cả ngày hôm sau uể oải.', 'khó chợp mắt vào lúc khuya khoắt'],
  ['Cơn đau đầu mãn tính', 'Những cơn nhức ở thái dương xuất hiện gần như mỗi chiều và làm mình khó tập trung. Người khám bệnh khuyên ghi lại thời điểm bị, thức ăn và giấc nghỉ. Uống đủ nước và tránh ánh sáng chói cũng giảm bớt.', 'cơn nhức óc dai dẳng không dứt'],
  ['Giảm cân lành mạnh', 'Mình hạ dần số ký bằng cách ăn nhiều rau, bớt đồ chiên và đi bộ mỗi tối. Không nhịn đói vì cơ thể sẽ phản ứng ngược. Mỗi tuần chỉ giảm nửa ký là đủ bền.', 'hạ trọng lượng cơ thể một cách an toàn'],
  ['Học ngoại ngữ nhanh', 'Mình nghe podcast mỗi sáng và chép lại những câu hay vào sổ. Dùng thẻ ghi nhớ giúp từ mới ở lại lâu hơn. Nói chuyện với bạn bè bằng tiếng nước ngoài mỗi tuần cũng rất hiệu quả.', 'mẹo thuộc vốn từ của một thứ tiếng khác'],
  ['Áp lực công việc', 'Hạn nộp dồn dập khiến vai mình cứng lại và đầu óc nặng trĩu. Mình chia việc thành phần nhỏ, nghỉ giữa giờ và trò chuyện với đồng nghiệp. Khi quá tải thì nói thẳng với quản lý.', 'căng thẳng ở chỗ làm'],
  ['Chọn nghề phù hợp', 'Mình liệt kê điều mình giỏi, điều mình thích và điều xã hội đang cần. Đi thực tế vài nơi giúp thấy rõ một ngày làm việc thật sự ra sao. Đừng chọn chỉ vì lương cao.', 'định hướng sự nghiệp cho người mới ra trường'],
  ['Xin nghỉ việc', 'Mình soạn sẵn lời nói lịch sự, nêu rõ ngày làm cuối cùng và cảm ơn mọi người. Bàn giao tài liệu gọn gàng để người sau đỡ vất vả. Giữ thái độ tử tế vì ngành này nhỏ.', 'cách nói lời chia tay với sếp'],
  ['Nuôi mèo con', 'Bé mới về nhà nên cần một góc ấm, bát nước sạch và hộp cát vệ sinh. Cho ăn nhiều bữa nhỏ trong ngày. Đưa đi tiêm phòng đúng lịch để bé luôn tươi tắn.', 'chăm bé miu mới đón về'],
  ['Du lịch bụi giá rẻ', 'Mình đặt phòng tập thể, ăn quán vỉa hè và đi xe buýt thay vì taxi. Mua vé sớm để có giá mềm. Cả chuyến chỉ tốn bằng nửa dự tính ban đầu.', 'đi chơi xa mà ít tốn kém'],
  ['Nấu cháo cho người ốm', 'Cháo trắng nấu nhừ với chút gừng giúp dễ nuốt. Thêm thịt gà xé nhỏ khi người bệnh đã thấy đói. Tránh đồ dầu mỡ trong những ngày đầu.', 'món ăn dễ tiêu cho người đang hồi phục'],
  ['Kiềm chế cơn giận', 'Khi thấy máu dồn lên mặt, mình đếm chậm đến mười và rời khỏi chỗ tranh cãi. Uống một ngụm nước, hít sâu rồi mới trả lời. Viết ra điều khó chịu cũng giúp nhẹ lòng.', 'bình tĩnh khi nổi nóng'],
  ['Thói quen đọc sách', 'Mỗi tối mình dành hai mươi phút với một cuốn truyện giấy, để máy xa giường. Đặt mục tiêu vài trang mỗi ngày thay vì cả chương.', 'nuôi dưỡng niềm say mê với những trang giấy'],
  ['Phỏng vấn xin việc', 'Mình tìm hiểu kỹ công ty, luyện trả lời những câu hay gặp và chuẩn bị vài câu hỏi ngược lại. Đến sớm mười phút, ăn mặc gọn gàng. Kể chuyện cụ thể thay vì nói chung chung.', 'gây ấn tượng với nhà tuyển dụng ở buổi gặp đầu tiên'],
  ['Trồng cây trong nhà', 'Một vài chậu lưỡi hổ và trầu bà đặt cạnh cửa sổ đã làm căn phòng dịu mắt. Tưới vừa đủ, tránh để đọng nước ở đáy chậu.', 'làm xanh căn hộ bằng chậu cảnh'],
];

// [person, role, similar person, similar role]
const PEOPLE = [
  ['Nguyễn Hữu Phước', 'kiến trúc sư', 'Nguyễn Hữu Phúc', 'thợ mộc'],
  ['Lê Thị Thanh Hương', 'nhạc sĩ', 'Lê Thị Thanh Hường', 'chuyên viên thuế'],
  ['Phạm Đức Thịnh', 'bác sĩ nhi', 'Phạm Đức Thành', 'lái xe'],
  ['Võ Thị Ngọc Ánh', 'nhiếp ảnh gia', 'Võ Thị Ngọc Anh', 'dược sĩ'],
  ['Đặng Minh Quân', 'kỹ sư cầu đường', 'Đặng Minh Quang', 'đầu bếp'],
  ['Bùi Thanh Tùng', 'nhà báo', 'Bùi Thanh Tú', 'họa sĩ'],
  ['Hoàng Mỹ Linh', 'biên dịch viên', 'Hoàng Mỹ Lan', 'nông dân'],
  ['Trương Quốc Khánh', 'thợ làm gốm', 'Trương Quốc Khang', 'huấn luyện viên'],
];
const PEOPLE_ACCENTED_QUERY = [false, false, false, false, true, true, true, true];

const PLACES = ['Đà Lạt', 'Quảng Ngãi', 'Cần Thơ', 'Hà Tĩnh', 'Bà Rịa', 'Phan Thiết', 'Hội An'];
const PLACE_ACCENTED_QUERY = [false, false, false, false, true, true, true];

// [group, note title, note sentence with the first form, query]. Group is "term = term = term" for the lexicon. The query is
// another form of the group alone; the title does not contain any form.
const SYNONYM = [
  ['ô tô = xe hơi = car', 'Việc cuối năm', 'Đưa ô tô đi thay nhớt và kiểm tra phanh sau mỗi năm nghìn cây số.', 'xe hơi'],
  ['điện thoại = phone = smartphone', 'Quà cho bố mẹ', 'Điện thoại cho bố mẹ cần chữ to, loa lớn và pin trâu.', 'phone'],
  ['lương = salary = tiền công', 'Cuối tháng mười', 'Bảng lương ghi đủ phụ cấp, thưởng và các khoản trừ trong tháng.', 'tiền công'],
  ['cà phê = coffee = cafe', 'Dự án nhỏ', 'Quán cà phê nhỏ cần mặt bằng vừa phải, máy xay tốt và vài món bánh.', 'coffee'],
  ['bác sĩ = thầy thuốc = doctor', 'Lịch hẹn gia đình', 'Bác sĩ gia đình theo dõi sức khoẻ cả nhà và giữ hồ sơ lâu dài.', 'thầy thuốc'],
  ['máy tính xách tay = laptop = notebook', 'Chuẩn bị nhập học', 'Máy tính xách tay cho sinh viên nên nhẹ, bền và pin dùng được cả buổi.', 'laptop'],
  ['sinh tố = smoothie', 'Công thức mùa hè', 'Sinh tố bơ xay cùng sữa đặc, đá và một ít đường.', 'smoothie'],
  ['hợp đồng = contract = giao kèo', 'Giấy tờ cần ký', 'Hợp đồng bán xe cần ghi giá, thời hạn sang tên và trách nhiệm hai bên.', 'giao kèo'],
  ['thư điện tử = email = e-mail', 'Liên lạc đối tác', 'Thư điện tử gửi đối tác nên có tiêu đề rõ và tóm tắt ở dòng đầu.', 'email'],
  ['tiền tiết kiệm = savings = tiền gửi', 'Của để dành cho con', 'Sổ tiền tiết kiệm của con ghi từng lần gửi và lãi cộng dồn.', 'savings'],
  ['mật khẩu = password = mã bí mật', 'An toàn cá nhân', 'Mật khẩu dài và khác nhau cho từng nơi đăng nhập sẽ an toàn hơn.', 'password'],
  ['chi phí = cost = kinh phí', 'Tiết giảm vận hành', 'Chi phí vận hành giảm khi gom đơn hàng và bỏ những khoản trùng lặp.', 'kinh phí'],
  ['học bổng = scholarship', 'Du học sau đại học', 'Học bổng du học yêu cầu bài luận, thư giới thiệu và bảng điểm.', 'scholarship'],
  ['thực tập sinh = intern = tập sự', 'Mùa hè năm nay', 'Thực tập sinh mùa hè được giao việc nhỏ và có người kèm cặp.', 'intern'],
  ['phần mềm = software = chương trình', 'Máy văn phòng', 'Phần mềm văn phòng cần cài cùng bộ gõ và phông chữ tiếng Việt.', 'chương trình'],
];

// [abbreviation, full form, note title, note sentence with the full form, query with the abbreviation]
const ABBR = [
  ['KH', 'khách hàng', 'Danh sách khách hàng tiềm năng', 'Danh sách khách hàng tiềm năng được cập nhật mỗi quý.', 'KH tiềm năng'],
  ['HĐ', 'hợp đồng', 'Hợp đồng thuê văn phòng', 'Hợp đồng thuê văn phòng có hiệu lực hai năm.', 'HĐ thuê văn phòng'],
  ['CSKH', 'chăm sóc khách hàng', 'Quy trình chăm sóc khách hàng sau bán', 'Quy trình chăm sóc khách hàng sau bán gồm gọi hỏi thăm và nhắc bảo hành.', 'quy trình CSKH sau bán'],
  ['NV', 'nhân viên', 'Quy chế nhân viên thử việc', 'Nhân viên thử việc được hướng dẫn trong hai tháng đầu.', 'NV thử việc'],
  ['DN', 'doanh nghiệp', 'Doanh nghiệp vừa và nhỏ', 'Doanh nghiệp vừa và nhỏ thường thiếu vốn lưu động.', 'DN vừa và nhỏ'],
  ['TMĐT', 'thương mại điện tử', 'Sàn thương mại điện tử', 'Sàn thương mại điện tử thu phí theo phần trăm đơn hàng.', 'sàn TMĐT'],
  ['BCTC', 'báo cáo tài chính', 'Báo cáo tài chính quý ba', 'Báo cáo tài chính quý ba nộp trước ngày hai mươi.', 'BCTC quý ba'],
  ['GĐ', 'giám đốc', 'Giám đốc điều hành', 'Giám đốc điều hành chủ trì họp giao ban cuối tuần.', 'GĐ điều hành'],
  ['PKD', 'phòng kinh doanh', 'Họp phòng kinh doanh sáng thứ hai', 'Họp phòng kinh doanh sáng thứ hai để chốt chỉ tiêu tuần.', 'họp PKD sáng thứ hai'],
  ['NCC', 'nhà cung cấp', 'Đánh giá nhà cung cấp mới', 'Đánh giá nhà cung cấp mới theo giá, thời gian giao và chất lượng.', 'đánh giá NCC mới'],
  ['ĐKKD', 'đăng ký kinh doanh', 'Giấy đăng ký kinh doanh', 'Giấy đăng ký kinh doanh cần bản sao công chứng.', 'giấy ĐKKD'],
  ['QLDA', 'quản lý dự án', 'Ban quản lý dự án xây dựng cầu', 'Ban quản lý dự án xây dựng cầu họp kiểm tra tiến độ hằng tuần.', 'ban QLDA xây dựng cầu'],
  ['CNTT', 'công nghệ thông tin', 'Ngành công nghệ thông tin', 'Ngành công nghệ thông tin tuyển nhiều vị trí mới mỗi năm.', 'ngành CNTT'],
  ['HĐQT', 'hội đồng quản trị', 'Biên bản hội đồng quản trị', 'Biên bản hội đồng quản trị ghi lại các quyết định quan trọng.', 'biên bản HĐQT'],
  ['BHXH', 'bảo hiểm xã hội', 'Đóng bảo hiểm xã hội', 'Đóng bảo hiểm xã hội đúng hạn để không mất quyền lợi.', 'đóng BHXH'],
];

// [note title, alias, English body]
const ALIAS = [
  ['Q4 roadmap', 'Kế hoạch quý bốn', 'Milestones and owners for the last quarter of the year.'],
  ['Weekly sync', 'Họp giao ban tuần', 'Agenda template for the Monday team call.'],
  ['Onboarding checklist', 'Danh sách tiếp nhận nhân sự', 'Accounts, equipment and first-week tasks for a new hire.'],
  ['Budget sheet', 'Bảng dự toán chi phí', 'Planned spending per category with a running total.'],
  ['Reading list', 'Danh mục sách cần đọc', 'Books queued for the next few months, ordered by priority.'],
  ['Travel packing', 'Hành lý chuyến đi', 'Items to pack by weather, plus papers to take along.'],
  ['Release notes', 'Ghi chú phát hành', 'User-facing changes grouped by feature for each version.'],
  ['Expense tracker', 'Sổ theo dõi chi tiêu', 'Daily purchases logged with category and payment method.'],
  ['Interview prep', 'Chuẩn bị phỏng vấn', 'Common questions, stories to tell and questions to ask back.'],
  ['Meal plan', 'Thực đơn cả tuần', 'Breakfast, lunch and dinner ideas with a shopping list.'],
  ['Study schedule', 'Lịch ôn tập', 'Blocks of review time per subject before the exam.'],
  ['Bug triage', 'Phân loại lỗi phần mềm', 'How incoming defects are labelled, ranked and assigned.'],
  ['Gift ideas', 'Gợi ý quà tặng', 'Present ideas per person with rough prices.'],
  ['Home repairs', 'Việc sửa chữa nhà cửa', 'Repairs waiting for a weekend, with parts to buy.'],
  ['Fitness log', 'Nhật ký tập luyện', 'Sets, distances and how each session felt.'],
];

const FILLER = [
  'Hôm nay trời nắng nhẹ, mình ngồi ở quán quen và ghi lại vài ý nghĩ rời rạc.',
  'Buổi chiều có cơn mưa ngắn, mùi đất ẩm bay lên từ con ngõ nhỏ.',
  'Mình để quyển sổ tay cạnh cửa sổ để lúc nào có ý là viết ngay.',
  'Chiếc xe đạp cũ vẫn chạy êm sau khi tra thêm dầu vào xích.',
  'Bà bán rau đầu chợ nhớ hết những người hay mua và luôn thêm một nắm hành.',
  'Cuối tuần cả nhà dọn lại góc bếp, vứt bớt những chiếc hộp không còn dùng.',
  'Tách trà nguội đi lúc nào không hay vì mình mải đọc dở một bài báo.',
  'Trên đường về, mình nghe lại một bài hát cũ và nhớ những buổi tan trường.',
  'Ngoài hiên, mấy chậu hoa giấy nở rộ sau đợt nắng đầu mùa.',
  'Mình tự hứa tuần sau sẽ dậy sớm hơn để đi bộ quanh hồ.',
  'Có những ngày chẳng làm được gì to tát, nhưng viết ra vài dòng là thấy nhẹ.',
  'Chiếc ô màu xanh lại bị bỏ quên ở quán, may mà chủ quán cất giúp.',
  'Tiếng chuông xe bán kem vang lên đúng lúc lũ trẻ trong xóm tan học.',
  'Mình xếp lại giá sách theo màu bìa, nhìn gọn mắt hơn hẳn.',
  'Buổi tối mát, gió từ sông thổi vào làm tờ giấy nháp bay xuống sàn.',
  'Một người bạn cũ nhắn hỏi thăm sau nhiều năm, mình trả lời mãi mới xong.',
  'Cái bàn gỗ ở góc phòng có vết cháy nhỏ từ hồi mới dọn về.',
  'Mình thử nướng bánh theo công thức của bà nhưng lò hơi nóng quá.',
  'Nắng chiều xiên qua rèm làm căn phòng ngả sang màu mật ong.',
  'Mấy con chim sẻ đậu trên dây điện, ríu rít suốt buổi sáng.',
  'Quán nước đầu ngõ treo thêm đèn lồng, trông ấm áp lạ.',
  'Mình ghi vội số điện thoại lên mu bàn tay vì quên mang giấy.',
  'Chợ phiên cuối tuần đông người, ai cũng xách theo một túi vải.',
  'Sau cơn mưa, con đường trước nhà sạch hẳn và thoang thoảng mùi cỏ.',
  'Đèn đường bật sớm vì trời âm u, bóng người đi bộ kéo dài trên vỉa hè.',
];
const FILLER_TOPICS = ['mưa chiều', 'quán quen', 'chiếc ô xanh', 'góc bếp', 'giá sách', 'xe đạp cũ', 'chợ phiên', 'hoa giấy', 'ngõ nhỏ', 'tách trà', 'đèn lồng', 'bài hát cũ', 'bánh nướng', 'hiên nhà', 'sổ tay'];
const MENTION = [
  (p) => `Ghi chú này nói về ${p}.`,
  (p) => `Mình quay lại chủ đề ${p} vì nó liên quan đến việc gần đây.`,
  (p) => `Về ${p}, điều quan trọng nhất là làm đều và ghi lại kết quả.`,
  (p) => `Nhắc lại cho khỏi quên: ${p}.`,
  (p) => `Một vài dòng xoay quanh ${p} để lần sau xem lại.`,
];

// ---- 0.12.0 cases ---------------------------------------------------------------------------------------------
// Cases that mirror how a language pack fails on a large real vault, where the earlier categories are already easy. Each
// entry carries a `cause`. They are generated after all other notes without rng calls, so every earlier note and golden
// entry is unchanged; the extra notes do change IDF and vector neighbours for the earlier queries.

// Background notes that make a few compounds common (in more than 10% of the notes): every note has one sentence of each
// group. The common compounds are thời gian, công việc, thông tin, sản phẩm, kế hoạch and công ty.
const COMMON_T = [
  'Tuần này mình phải sắp lại thời gian vì việc nhà nhiều hơn.',
  'Thời gian gần đây mình ngủ muộn hơn thường lệ.',
  'Mình chưa có thời gian đọc hết tập giấy tờ, để tối nay xem tiếp.',
  'Cả nhóm thống nhất dành thêm thời gian cho khâu kiểm tra.',
  'Thời gian đi đường buổi sáng dài ra vì đoạn đường đang sửa.',
];
const COMMON_W = [
  'Công việc dạo này ổn, chỉ hơi nhiều giấy tờ.',
  'Công việc dồn lại từ hôm thứ hai nên chiều nay ở lại muộn.',
  'Mình chia công việc thành từng phần nhỏ cho dễ theo dõi.',
  'Có hôm công việc trôi chảy, có hôm chẳng xong được gì.',
  'Mọi người trong nhóm chia nhau công việc rất gọn.',
];
const COMMON_I = [
  'Thông tin về sản phẩm mới được gửi vào nhóm chung từ sáng.',
  'Mình ghi lại vài thông tin về sản phẩm để khi cần là tìm được ngay.',
  'Trang giới thiệu sản phẩm còn thiếu thông tin về cách đổi trả.',
  'Ai cũng hỏi thông tin về sản phẩm sắp ra mắt.',
];
const COMMON_P = [
  'Kế hoạch của công ty thay đổi một chút sau buổi họp chiều qua.',
  'Công ty đang lên kế hoạch cho đợt nghỉ lễ sắp tới.',
  'Kế hoạch năm sau của công ty vẫn đang chờ duyệt.',
  'Bên công ty bạn mình cũng có kế hoạch tương tự.',
];
const COMMON_NOTES = 80;

// iy-mixed: notes on the same topic use both spellings. [query, answer title, answer body (other spelling),
// near notes [title, body] in the query's spelling that share only part of the query]
const IY_MIXED = [
  ['kỹ năng đàm phán giá thuê nhà', 'Thuê căn hộ đầu tiên',
    'Mình ghi lại mấy kĩ năng đàm phán giá thuê nhà học được sau lần chuyển chỗ ở. Hỏi giá các căn quanh đó trước, xin bớt nếu thuê dài hạn và chụp ảnh hiện trạng trước khi dọn vào.',
    [['Đàm phán với chủ xưởng', 'Kỹ năng thương lượng với chủ xưởng gỗ khác hẳn khi mua lẻ. Kỹ năng quan trọng nhất là biết lúc nào nên dừng.'],
      ['Tìm thợ sơn nhà', 'Thợ sơn có kỹ năng tốt thường báo giá cao hơn một chút. Mình hỏi ba người rồi mới chọn, giá nhà bên cạnh trả cũng tham khảo được.']]],
  ['lí do bỏ lớp học thêm', 'Con không muốn đi học thêm',
    'Hôm nay con nói thật lý do bỏ lớp học thêm buổi tối: lớp đông, cô giảng nhanh và về nhà quá muộn. Mình đồng ý cho con tự ôn ở nhà một tháng xem sao.',
    [['Lớp vẽ cuối tuần', 'Lí do mình chọn lớp vẽ này là gần nhà và học buổi sáng. Lớp nhỏ, ai cũng được thầy sửa bài.'],
      ['Bỏ thức khuya', 'Lí do lớn nhất khiến mình bỏ được tật thức khuya là có thêm giờ đi bộ buổi sáng.']]],
  ['kĩ thuật ghép cành bưởi', 'Vườn nhà ông ngoại',
    'Ông ngoại dạy mình kỹ thuật ghép cành bưởi: chọn cành bánh tẻ, cắt vát, buộc chặt bằng dây ni lông và che nắng vài tuần.',
    [['Chiết cành cam', 'Kĩ thuật chiết cành cam đơn giản hơn ghép, chỉ cần bó bầu đất và chờ ra rễ.'],
      ['Bón phân cho cây ăn quả', 'Mấy gốc bưởi sau nhà cần bón phân đúng kĩ thuật, chia làm nhiều lần trong năm.']]],
  ['quản lí giấy tờ nhà đất', 'Hộp hồ sơ gia đình',
    'Bố dặn mình cách quản lý giấy tờ nhà đất: bản gốc cất hộp chống ẩm, bản sao để riêng, mỗi lần đi làm thủ tục thì ghi lại ngày nộp.',
    [['Sắp xếp tủ tài liệu', 'Quản lí tài liệu ở văn phòng theo màu bìa giúp tìm nhanh hơn.'],
      ['Mấy mảnh đất ở quê', 'Chú mình quản lí mấy mảnh đất ở quê, giấy tờ để chung một túi nên lần nào tìm cũng mất cả buổi.']]],
  ['kỳ nghỉ hè ở quê ngoại', 'Tuổi thơ ở làng',
    'Kì nghỉ hè ở quê ngoại năm ấy mình học bơi ngoài sông, theo các anh đi thả diều và tối nào cũng nghe bà kể chuyện.',
    [['Đi biển với lớp cũ', 'Kỳ nghỉ hè này cả lớp cũ hẹn nhau ra biển ba ngày.'],
      ['Quê nội mùa gặt', 'Kỳ nghỉ năm ngoái mình về quê nội đúng mùa gặt, đồng lúa vàng cả một vùng.']]],
];

// common-compound: a common compound plus specific words; the answer has the words but not as the query phrase, two
// near notes share the compound or one more query word. [compound, rest of the query, answer title, body, near notes]
const COMMON_COMPOUND = [
  ['thời gian', 'ủ bột bánh mì', 'Mẻ bánh đầu tiên',
    'Mẻ bánh mì sáng nay nở đều vì bột được ủ qua đêm trong tủ mát. Lần sau mình sẽ ghi lại thời gian ủ cho từng loại bột.',
    [['Tiệm bánh đầu ngõ', 'Thời gian chờ bánh mì ở tiệm đầu ngõ dài hơn mọi khi, ai cũng phải đứng đợi.'],
      ['Bột mì trong bếp', 'Túi bột mì mua về để trong hũ kín cho khỏi ẩm. Dạo này mình không có thời gian vào bếp.']]],
  ['công việc', 'sửa mái tôn bị dột', 'Nhà sau mưa lớn',
    'Mái tôn phía sau nhà bị dột ở hai chỗ sau trận mưa lớn. Thợ hẹn cuối tuần sang thay tấm mới, công việc chắc mất một buổi sáng.',
    [['Sửa xe cuối tuần', 'Công việc cuối tuần là sửa lại cái yên xe bị rách.'],
      ['Mái hiên quán nước', 'Mái hiên của quán nước đầu ngõ bị dột, nước nhỏ giọt xuống bàn.']]],
  ['kế hoạch', 'trồng hoa hồng leo ban công', 'Ban công hướng đông',
    'Ban công hướng đông đủ nắng cho mấy gốc hồng leo mới mua. Kế hoạch là trồng thêm hai chậu và làm giàn bằng tre để hoa bò lên.',
    [['Dọn ban công', 'Kế hoạch cuối tuần là dọn lại ban công, bỏ bớt chậu vỡ.'],
      ['Bình hoa trên bàn', 'Mấy bông hoa hồng cắm bình từ hôm qua đã bắt đầu héo.']]],
  ['thông tin', 'lịch tiêm phòng cho chó con', 'Bé cún mới về',
    'Chú chó con nhà mình được ba tháng tuổi, người khám ở phòng thú y dặn lịch tiêm phòng mũi tiếp theo. Mình ghi lại thông tin vào sổ để khỏi quên.',
    [['Chó lạc ở khu phố', 'Thông tin về chú chó lạc được dán ở bảng tin của khu phố.'],
      ['Lịch tiêm cho con', 'Lịch tiêm phòng của con gái tháng này có thêm một mũi nhắc lại.']]],
  ['sản phẩm', 'nến thơm từ sáp đậu nành', 'Làm nến ở nhà',
    'Mẻ nến thơm đầu tiên mình làm từ sáp đậu nành, thêm vài giọt tinh dầu sả. Sản phẩm cháy đều, không khói, bạn bè xin mỗi người một hũ.',
    [['Sữa hạt buổi sáng', 'Sản phẩm sữa đậu nành đóng chai ở siêu thị ngọt hơn mình nghĩ.'],
      ['Sinh nhật bé út', 'Mấy cây nến cắm trên bánh kem được bé út thổi tắt trong một hơi.']]],
];

// common-abbr: abbreviations whose full phrase is common (more than 5% of the notes). The answer writes the full
// phrase, or the abbreviation itself as people do. [abbreviation, full phrase, query, answer title, body, near notes]
const COMMON_ABBR = [
  ['CV', 'công việc', 'CV bàn giao kho lạnh', 'Xưởng mới',
    'Tuần này mình nhận bàn giao kho lạnh ở xưởng mới. Công việc gồm kiểm nhiệt độ từng ngăn và dán nhãn hàng.',
    [['Bàn giao ca đêm', 'Công việc bàn giao ca đêm phải ghi đủ số liệu vào sổ trước khi về.'],
      ['Kho đồ cũ', 'Kho chứa đồ cũ sau nhà lạnh và ẩm, công việc dọn dẹp để sang tháng.']]],
  ['TT', 'thông tin', 'TT tuyển sinh lớp vẽ thiếu nhi', 'Lớp vẽ cho bé',
    'Mình gom TT tuyển sinh lớp vẽ thiếu nhi của câu lạc bộ phường: học sáng thứ bảy, mỗi khoá tám buổi, có sẵn màu.',
    [['Tuyển sinh đầu cấp', 'Thông tin tuyển sinh đầu cấp năm nay được dán ở cổng trường.']]],
  ['SP', 'sản phẩm', 'SP gốm men lam', 'Lò gốm quê',
    'Mấy chiếc bình gốm men lam ra lò tuần trước đã hết sạch. Khách quen hỏi bao giờ có lại sản phẩm này.',
    [['Chợ gốm cuối tuần', 'Sản phẩm gốm ở chợ phiên cuối tuần phần lớn là men nâu.']]],
  ['TG', 'thời gian', 'TG phơi mực một nắng', 'Mực câu ở làng biển',
    'Mực câu về phải phơi đúng một nắng thì thịt mới ngọt; TG phơi tuỳ trời, nắng gắt chỉ nửa ngày.',
    [['Phơi chăn đầu mùa', 'Thời gian phơi chăn mùa này ngắn vì nắng yếu.'],
      ['Cá khô một nắng', 'Một nắng là cách gọi mẻ cá chỉ phơi trong một ngày.']]],
  ['CTy', 'công ty', 'CTy lắp đặt điện mặt trời', 'Mái xưởng bên cạnh',
    'Công ty bên cạnh vừa lắp đặt hệ thống điện mặt trời trên mái xưởng, nghe nói tiền điện tháng sau giảm hẳn.',
    [['Đèn sân vườn', 'Mấy cây đèn năng lượng mặt trời ngoài sân sáng đến gần nửa đêm.'],
      ['Cắt điện chủ nhật', 'Công ty điện lực báo cắt điện sáng chủ nhật để sửa đường dây.']]],
];

// Notes typed without diacritics, full of function-word pairs (for function-pairs).
const UNACCENTED_CHAT = [
  'hom nay minh ve muon, cung khong biet la co nen di tap hay khong. nhung dieu can lam thi van chua xong, vi vay de mai tinh tiep.',
  'minh thay la khi nao ranh thi nen goi cho ba me. nhung viec nho nhu the ma de lau thi cung thanh to.',
  'co the la tuan sau moi xong, vi con cho them giay to. neu duoc thi minh se bao lai cho moi nguoi.',
  'khong biet nen bat dau tu dau, nhung ma cu lam tung chut mot thi cung xong. dieu quan trong la dung bo giua chung.',
  'luc truoc minh hay de do lung tung, gio thi da quen xep lai sau khi dung. nhu vay de tim hon.',
  'neu ma troi mua thi minh o nha, con khong thi ra cong vien di bo mot vong cho khoe.',
];
// function-pairs: an accented query with a function-word pair that the unaccented notes above also have; the answer is
// an accented note. [query, answer title, body, accented near note]
const FUNCTION_PAIRS = [
  ['những điều cần biết khi nuôi ong lấy mật', 'Thùng ong sau vườn',
    'Nuôi ong lấy mật cần đặt thùng nơi râm mát, gần nguồn hoa và tránh phun thuốc quanh đó. Mỗi tuần mở thùng một lần để xem ong chúa còn đẻ đều không.',
    ['Mật ong rừng', 'Hũ mật ong rừng bạn gửi biếu đặc và thơm mùi hoa.']],
  ['khi nào nên thay lọc gió điều hoà', 'Bảo dưỡng máy lạnh',
    'Máy lạnh trong phòng ngủ chạy cả mùa hè nên tấm lọc bụi bám dày. Cứ hai tháng mình tháo ra rửa một lần, máy mát hơn hẳn.',
    ['Gió mùa về', 'Gió mùa về, cả nhà lôi chăn dày ra phơi.']],
  ['có thể trồng rau thơm trong chậu nhỏ không', 'Góc rau thơm',
    'Mấy chậu nhựa nhỏ trên bậu cửa sổ trồng húng quế, tía tô và rau mùi vẫn lên tốt, miễn đủ nắng buổi sáng và tưới vừa phải.',
    ['Rau thơm ăn kèm', 'Đĩa rau thơm ăn kèm bún chả có kinh giới và tía tô.']],
  ['nên bắt đầu từ đâu khi học vẽ màu nước', 'Vẽ màu nước',
    'Mình mua bộ màu nước loại rẻ, giấy dày và hai cây cọ tròn. Tuần đầu chỉ tập loang màu và vẽ trái táo, đừng vội vẽ phong cảnh.',
    ['Màu nước trên tường', 'Bức tường sau nhà ngấm màu nước mưa thành vệt loang.']],
  ['như vậy có nên mua máy hút bụi không dây', 'Dọn nhà cuối tuần',
    'Cây hút bụi cầm tay chạy pin giúp mình dọn gầm giường và kẽ sofa nhanh gấp đôi. Pin dùng được khoảng nửa tiếng.',
    ['Bụi mịn mùa khô', 'Mùa khô bụi mịn nhiều, ra đường nhớ đeo khẩu trang.']],
];

// few-unaccented-pairs: an accented query whose answer is a note typed without diacritics, where fewer than half of the
// query's adjacent word pairs occur unaccented in the vault. [query, answer title, body, accented near note]
const FEW_UNACCENTED_PAIRS = [
  ['cách làm mứt dừa non', 'Mut tet nam nay',
    'tet nay minh tu nau mut. chon dua non mua o cho, bao soi roi ngam nuoc voi, sen voi duong va dao lua nho den khi kho.',
    ['Mứt gừng', 'Mứt gừng ngày tết cay nồng, mình chỉ ăn một miếng là đủ.']],
  ['kinh nghiệm thuê xe tự lái đi Mộc Châu', 'Len vung cao',
    'thang truoc ca nhom len moc chau, tu lai chiec xe so thue o ha noi. kinh nghiem rut ra: dat xe truoc mot tuan, chup anh xe luc nhan va do day xang truoc khi tra.',
    ['Thuê xe đi đám cưới', 'Nhà mình thuê xe bảy chỗ đi đám cưới ở quê, tài xế đón tận cửa.']],
  ['lịch tập chạy bộ cho người mới bắt đầu', 'Chay bo 5km',
    'tuan dau chi chay xen ke di bo, moi buoi hai muoi phut. nguoi moi thi dung co chay nhanh, cu giu nhip tho deu la duoc. lich cua minh: thu hai, thu tu, thu sau.',
    ['Đôi giày chạy bộ mới', 'Đôi giày chạy bộ mới êm chân, mình đi thử quanh công viên.']],
  ['cách khử mùi hôi tủ lạnh', 'Tu lanh nha bep',
    'tu lanh de lau bi hoi, minh lau sach ben trong bang nuoc chanh roi de mot chen than hoat o ngan duoi.',
    ['Mùi sơn mới', 'Phòng mới sơn còn mùi hôi, mình mở toang cửa sổ cả ngày.']],
  ['tự sửa bóng đèn huỳnh quang bị nhấp nháy', 'Den phong khach',
    'bong den o phong khach cu nhap nhay hoai, thay con chuot (tac te) la het. lan sau nho mua san mot con de du phong.',
    ['Đèn ngủ cho bé', 'Đèn ngủ ánh vàng dịu, bé ngủ ngon hơn hẳn.']],
];

// idea: idea-style queries; the answer shares no content word with the query, two notes share its generic words.
// [query, answer title, body, near notes]
const IDEA = [
  ['làm sao để bớt run khi đứng trước nhiều người', 'Sợ sân khấu',
    'Tim đập nhanh, tay lạnh ngắt mỗi lần lên phát biểu ở hội nghị. Mình tập hít thở bằng bụng, nhìn vào vài gương mặt quen dưới khán phòng và chuẩn bị thật chu đáo phần mở đầu.',
    [['Xếp hàng mua vé', 'Nhiều người đứng xếp hàng từ sáng sớm trước cửa rạp, không biết làm sao để mua được vé.'],
      ['Chụp ảnh tập thể', 'Khi đứng trước ống kính, nhiều người hay nhắm mắt nên phải chụp lại mấy lần.']]],
  ['cách giữ cho đầu óc tỉnh táo suốt buổi chiều', 'Uể oải sau bữa trưa',
    'Sau bữa trưa mình hay ngáp liên tục. Chợp mắt mười lăm phút, uống ngụm trà xanh và đứng dậy vươn vai giúp tinh thần minh mẫn trở lại.',
    [['Giữ ấm cho bé', 'Cách giữ ấm cho bé khi trời trở lạnh là mặc nhiều lớp mỏng.'],
      ['Buổi chiều ở hiệu sách', 'Suốt buổi chiều mình ngồi đọc ở hiệu sách cũ, quên cả giờ về.']]],
  ['muốn con nhỏ chịu ăn rau thì nên làm gì', 'Bé kén ăn',
    'Bé nhà mình gạt hết phần xanh ra mép đĩa. Mình thử cắt củ quả thành hình ngôi sao, cho bé tự nhặt ở chợ và nấu cùng, thế là bé gắp hết cả bát.',
    [['Rau muống luộc', 'Rau muống luộc chấm nước tương là món ăn quen của cả nhà.'],
      ['Con mèo nhỏ nhà bên', 'Con mèo nhỏ nhà bên không chịu ăn hạt, chỉ thích cá.']]],
  ['làm thế nào để không quên những việc nhỏ trong ngày', 'Gạch đầu dòng mỗi sáng',
    'Mỗi sáng mình liệt kê vài gạch đầu dòng, tối đánh dấu cái đã xong và chuyển cái dở sang hôm sau. Nhờ vậy ít bỏ sót lời hẹn.',
    [['Việc nhỏ trong nhà', 'Những việc nhỏ trong nhà như thay bóng đèn, lau quạt thường bị để đến cuối tháng.'],
      ['Quên chìa khoá', 'Sáng nay vội quá nên mình lại quên chìa khoá ở nhà.']]],
  ['làm sao để căn phòng nhỏ trông rộng hơn', 'Góc ở mười hai mét vuông',
    'Mình sơn tường màu sáng, treo một tấm gương lớn đối diện cửa sổ và chọn giường có ngăn kéo bên dưới. Đồ đạc gọn thì mắt thấy thoáng hẳn.',
    [['Căn phòng cuối hành lang', 'Căn phòng nhỏ cuối hành lang dùng làm kho chứa đồ.'],
      ['Phòng khách nhà bác', 'Phòng khách nhà bác rộng hơn nhà mình nhiều, trông lúc nào cũng sáng.']]],
];

// title-phrase: the overview note answers the query (phrase once in its body); a narrow note has the phrase in its title
// and is only partly relevant. [query, overview title, body, narrow title, body]
const TITLE_PHRASE = [
  ['chuẩn bị đồ đi cắm trại', 'Danh sách mang theo khi đi dã ngoại',
    'Lều hai lớp, túi ngủ, đèn pin, bếp ga mini, nồi nhỏ, nước uống và túi rác. Mỗi lần chuẩn bị đồ đi cắm trại mình dò lại danh sách này, thêm áo mưa nếu dự báo có mưa.',
    'Chuẩn bị đồ đi cắm trại cho mèo', 'Mang theo dây dắt, hộp cát gấp gọn và ít hạt quen là bé mèo yên tâm.'],
  ['tập bơi cho người lớn', 'Bơi lội ở tuổi ba mươi',
    'Mình bắt đầu tập bơi cho người lớn ở hồ bơi quận. Tuần đầu làm quen với nước và tập thở, tuần thứ hai tập nổi, sang tuần thứ ba mới đạp chân và quạt tay. Đến cuối tháng mình bơi được hết chiều ngang hồ.',
    'Tập bơi cho người lớn: chọn kính bơi', 'Kính bơi nên ôm mặt, có lớp chống mờ và dây dễ chỉnh.'],
  ['làm sữa chua tại nhà', 'Hũ men cái và những mẻ đầu tiên',
    'Muốn làm sữa chua tại nhà chỉ cần sữa tươi, sữa đặc và một hũ men cái. Đun sữa ấm vừa tay, khuấy đều với men, chia hũ rồi ủ ấm tám tiếng. Mẻ đầu hơi chua, mẻ sau giảm men là vừa.',
    'Làm sữa chua tại nhà bị chảy nước', 'Sữa chua chảy nước thường do ủ quá nóng hoặc men đã cũ.'],
  ['sửa vòi nước bị rỉ', 'Tự xoay xở với đồ nước trong bếp',
    'Khoá van tổng trước, tháo tay vặn, thay ron cao su và quấn băng tan quanh ren. Lần đầu sửa vòi nước bị rỉ mình mất cả tiếng, giờ chỉ mười phút. Bồn rửa nghẹt thì dùng que thông và nước nóng.',
    'Sửa vòi nước bị rỉ: mua ron ở đâu', 'Tiệm điện nước đầu chợ bán đủ cỡ ron, mang ron cũ ra so cho chắc.'],
  ['lên thực đơn ăn dặm cho bé', 'Bé tập ăn từ tháng thứ sáu',
    'Tháng đầu cho bé ăn bột loãng một bữa, rồi tăng dần độ đặc. Mỗi tuần mình lên thực đơn ăn dặm cho bé, thử một loại rau củ mới trong ba ngày để xem bé có dị ứng không.',
    'Lên thực đơn ăn dặm cho bé: cháo bí đỏ', 'Bí đỏ hấp chín, nghiền mịn rồi trộn vào cháo trắng.'],
];

// rare-identifier: an accented query with an identifier or product name that only the answer has, once; other notes are
// about the general topic. [query, identifier, answer title, body, near notes]
const RARE_IDENTIFIER = [
  ['lỗi ECONNRESET khi gọi máy chủ', 'ECONNRESET', 'Sự cố đêm thứ sáu',
    'Đêm qua hàng đợi báo lỗi ECONNRESET liên tục khi gọi sang máy chủ bên đối tác; tăng thời gian chờ và thử lại là ổn.',
    [['Máy chủ chậm giờ cao điểm', 'Máy chủ nội bộ chạy chậm vào giờ cao điểm, cần thêm bộ nhớ.'],
      ['Mạng ở nhà hay rớt', 'Mạng ở nhà hay rớt, khởi động lại bộ phát là kết nối lại được.']]],
  ['cài Zotero để viết luận văn', 'Zotero', 'Trích dẫn nguồn tham khảo',
    'Mình dùng Zotero để gom nguồn tham khảo, xuất trích dẫn thẳng vào bản thảo.',
    [['Viết luận văn', 'Luận văn cần mục lục rõ ràng và danh mục tài liệu tham khảo đúng mẫu.'],
      ['Cài lại máy', 'Cài lại máy xong mình mất cả buổi để chép lại các tệp cũ.']]],
  ['bảo hành máy giặt Toshiba', 'Toshiba', 'Máy giặt kêu to',
    'Máy giặt Toshiba cửa trên kêu to khi vắt; gọi tổng đài, thợ đến thay giảm xóc miễn phí vì còn hạn.',
    [['Máy giặt mới', 'Máy giặt cửa ngang tiết kiệm nước hơn loại cửa trên.'],
      ['Phiếu bảo hành', 'Phiếu bảo hành của nồi chiên ghi rõ thời hạn mười hai tháng.']]],
  ['đặt vé tàu SE3 đi Huế', 'SE3', 'Về miền Trung dịp lễ',
    'Mình đặt được hai vé tàu SE3, giường nằm khoang bốn, khởi hành tối thứ năm.',
    [['Tàu đêm vào miền Trung', 'Đi tàu đêm vào miền Trung, sáng ra nhìn thấy biển ngay bên cửa sổ.'],
      ['Đi Huế ăn bún bò', 'Chuyến đi Huế lần trước mình ăn bún bò mỗi sáng.']]],
  ['mã lỗi E21 bếp từ', 'E21', 'Bếp nhà mình',
    'Bếp từ đang nấu tự tắt và hiện mã E21; lau sạch quạt tản nhiệt phía dưới là hết.',
    [['Chọn nồi cho bếp từ', 'Nồi đáy phẳng nhiễm từ mới dùng được với bếp từ.'],
      ['Mã giảm giá', 'Mã giảm giá của cửa tiệm chỉ dùng được đến hết tháng.']]],
];

// toneless-iy: unaccented queries with a toneless i/y syllable (mi, ti, vi, hi, li) in a vault that also has English
// notes using the other spelling as a word (my, hi) and many Vietnamese notes with the other spelling (công ty, ly).
// [query, answer title, body]
const TONELESS_IY = [
  ['uon mi cong tu nhien', 'Trang điểm nhẹ', 'Mình dùng kẹp uốn mi rồi chải một lớp mực mỏng cho mi cong tự nhiên.'],
  ['sua ti vi bi mat tieng', 'Góc giải trí', 'Ti vi trong phòng khách tự nhiên mất tiếng, thợ đến thay bo mạch âm thanh là xong.'],
  ['hi vong con do dai hoc', 'Mùa thi của con',
    'Mùa thi năm nay con ôn rất chăm, cả nhà chỉ mong con vào được trường đại học gần nhà. Bố bảo cứ hi vọng nhưng đừng tạo áp lực.'],
  ['vi khuan tren thot go', 'Vệ sinh bếp', 'Thớt gỗ dùng lâu dễ bám vi khuẩn, mình rửa bằng nước nóng và phơi nắng mỗi tuần.'],
  ['li nuoc ep cam buoi sang', 'Bữa sáng nhanh', 'Mỗi sáng mình uống một li nước ép cam với lát bánh mì nướng.'],
];
const TONELESS_IY_NEAR = [
  ['My weekly review', 'My plan for the week: my errands, my reading, my workouts and my calls.'],
  ['My camera settings', 'My lens, my tripod and my presets for night shots.'],
  ['Hi team update', 'Hi team, hi again: the vendor call moved to Thursday.'],
  ['Ly trà chiều', 'Chiều nào mình cũng pha một ly trà gừng.'],
];

// ---- build -----------------------------------------------------------------------------------------------------

export function build({ seed = 11, answersOut = options.answersOut.default } = {}) {
  const { pick, chance } = createRng(seed);
  const files = new Map();
  const notes = [];   // { path, text } in insertion order, searched by the self-check
  const golden = [];
  const filler = (n) => Array.from({ length: n }, () => pick(FILLER)).join(' ');
  const put = (rel, text) => { if (files.has(rel)) throw new Error(`vi-search: duplicate path ${rel}`); files.set(rel, text); notes.push({ path: rel, text: nfc(text).toLowerCase(), raw: nfc(text) }); return rel; };
  const note = (title, body) => put(`notes/${title}.md`, `# ${title}\n\n${body}\n`);
  const topicBody = (phrase) => `${filler(2)}\n\n${pick(MENTION)(phrase)} ${filler(1)} ${pick(MENTION)(phrase)}\n\n${filler(2)}`;
  const repeatBody = (phrase) => `${MENTION.map((m) => m(phrase)).slice(0, 4).join(' ')}\n\n${filler(2)}`;

  const counts = {};
  const add = (category, query, relevant, extra = {}, notesText = '') => {
    const n = (counts[category] = (counts[category] || 0) + 1);
    golden.push({ id: `${category}-${String(n).padStart(2, '0')}`, query: nfc(query), relevant_paths: relevant, partial_paths: [], category, notes: notesText, ...extra });
  };
  // Every note whose text contains `phrase` must be exactly `expected`, or the golden set would lie.
  const abbr0 = (a) => nfc(a);
  const expectNotes = (phrase, expected) => {
    const p = nfc(phrase).toLowerCase();
    if (expected === null) {
      const re = new RegExp(`(^|[^\\p{L}])${abbr0(phrase)}([^\\p{L}]|$)`, 'u');
      const hit = notes.filter((n) => re.test(n.raw)).map((n) => n.path);
      if (hit.length) problems.push(`abbreviation "${phrase}" is written in ${JSON.stringify(hit.slice(0, 3))}`);
      return;
    }
    const found = notes.filter((n) => n.text.includes(p)).map((n) => n.path).sort();
    const want = [...expected].sort();
    if (JSON.stringify(found) !== JSON.stringify(want)) problems.push(`"${phrase}" is in ${JSON.stringify(found)}, expected ${JSON.stringify(want)}`);
  };
  const problems = [];
  // The abbreviation must not be written anywhere in the vault as a word, in that exact case.
  const expectWord = (abbr) => checks.push([abbr, null]);
  const checks = [];  // run after all notes exist
  const expect = (phrase, expected) => checks.push([phrase, expected]);

  // 1. Set A: accented, partial accent, telex, typo, snippet share the same 15 notes.
  const setA = SET_A.map((phrase) => note(cap(phrase), topicBody(phrase)));
  SET_A.forEach((phrase, i) => {
    expect(phrase, [setA[i]]);
    add('vi-accented', phrase, [setA[i]], {}, 'Query is the accented phrase of the note.');
    add('vi-partial-accent', partialAccent(phrase), [setA[i]], {}, 'First word keeps its marks, the other words lose them.');
    add('vi-telex', telex(phrase), [setA[i]], {}, 'Query is the phrase typed in Telex without composing it.');
    add('vi-typo', typo(phrase), [setA[i]], {}, 'Unaccented phrase with the last two letters of two words swapped.');
    const words = phrase.split(' ');
    const [from, to] = SNIPPET_SLICE[i];
    const slice = words.slice(from, to);
    add('vi-snippet', strip(slice.join(' ')), [setA[i]], { snippet_contains: slice.join(' '), matched_terms: slice.map((w) => strip(w)) },
      `Snippet must be original text with marks and contain "${slice.join(' ')}".`);
  });

  // 2. Unaccented and dd clusters: 25 near-identical notes each, 15 queried.
  const cluster = (terms, title, body, category, noteText) => {
    const rels = terms.map((t, i) => note(`${title} ${String(i + 1).padStart(2, '0')}`, body(t)));
    terms.forEach((t, i) => {
      expect(t, [rels[i]]);
      if (i >= 15) return;
      foldChecks.push([t, rels[i]]);
      add(category, strip(t), [rels[i]], { query_accented: nfc(t) }, noteText);
    });
  };
  const foldChecks = [];
  cluster(UNACCENTED_TERMS, 'Ghi chép món ăn',
    (t) => `Hôm nay mình ghi lại về ${t}. Mình nhớ ${t} nhất vào những buổi chiều cuối tuần, cả nhà ngồi ăn cùng nhau.`,
    'vi-unaccented', 'Query is a dish name without diacritics; 24 other notes have the same text with another dish name and the title does not name the dish.');
  cluster(DD_TERMS, 'Ghi chép địa điểm',
    (t) => `Hôm nay mình ghi lại về phố ${t}. Mình nhớ phố ${t} nhất vào những buổi chiều cuối tuần, đi dạo cùng cả nhà.`,
    'vi-dd', 'Query is a street name with đ written as d; 24 other notes have the same text with another street and the title does not name the street.');

  // 3. y/i spelling.
  SET_IY.forEach((y, i) => {
    const noteForm = i % 2 === 0 ? y : toI(y);
    const queryForm = i % 2 === 0 ? toI(y) : y;
    if (noteForm === queryForm) throw new Error(`vi-search: no y/i variant in "${y}"`);
    const rel = note(cap(noteForm), topicBody(noteForm));
    expect(noteForm, [rel]); expect(queryForm, []);
    add('vi-iy', queryForm, [rel], {}, `Note spells "${noteForm}"; query spells "${queryForm}".`);
  });

  // 4. Tone placement.
  SET_TP.forEach((old, i) => {
    const noteForm = i % 2 === 0 ? old : toNewStyle(old);
    const queryForm = i % 2 === 0 ? toNewStyle(old) : old;
    if (noteForm === queryForm) throw new Error(`vi-search: no tone placement variant in "${old}"`);
    const rel = note(cap(noteForm), topicBody(noteForm));
    expect(noteForm, [rel]); expect(queryForm, []);
    add('vi-tone-placement', queryForm, [rel], {}, `Note writes "${noteForm}"; query writes "${queryForm}".`);
  });

  // 5. Tone precision: the other note differs from the target only by a tone mark in the matched word.
  TONE_PAIRS.forEach(([phrase, title, other, otherTitle]) => {
    const target = note(title, repeatBody(phrase));
    note(otherTitle, repeatBody(other));
    expect(phrase, [target]);
    add('vi-tone-precision', phrase, [target], {}, `Must not rank the note about "${other}" above the note about "${phrase}".`);
  });

  // 6. Compounds: the neighbour shares one syllable with the query compound.
  COMPOUND_PAIRS.forEach(([phrase, title, other, otherTitle]) => {
    const target = note(title, repeatBody(phrase));
    note(otherTitle, repeatBody(other));
    expect(phrase, [target]);
    add('vi-compound', phrase, [target], {}, `Must not rank the note about "${other}" above the note about "${phrase}".`);
  });

  // 7. Vietnamese with English words.
  MIXED_EN.forEach(([title, query, mustHave]) => {
    const rel = note(title, `${filler(1)}\n\n${pick(MENTION)(nfc(title).toLowerCase())} ${filler(2)}`);
    if (!nfc(title).toLowerCase().includes(mustHave)) throw new Error(`vi-search: "${title}" lacks "${mustHave}"`);
    add('vi-mixed-en', query, [rel], {}, 'Query mixes English words or translates them to Vietnamese or the other way round.');
  });

  // 8. Semantic.
  SEMANTIC.forEach(([title, body, query]) => {
    const rel = note(title, body);
    add('vi-semantic', query, [rel], {}, 'Query paraphrases the topic with different words.');
  });

  // 9. Names and places, each with a similar name as decoy.
  PEOPLE.forEach(([person, role, similar, similarRole], i) => {
    const rel = note(person, `${person} là ${role}. ${filler(2)} Mình ghi lại cuộc trò chuyện với ${person} để lần sau nhớ.`);
    note(similar, `${similar} là ${similarRole}. ${filler(2)} Đừng nhầm với người cùng họ tên gần giống.`);
    expect(person, [rel]);
    add('vi-names', PEOPLE_ACCENTED_QUERY[i] ? person : strip(person), [rel], {}, `Person name ${PEOPLE_ACCENTED_QUERY[i] ? 'with' : 'without'} diacritics; a similar name is in the vault.`);
  });
  PLACES.forEach((place, i) => {
    const rel = note(`Chuyến đi ${place} cuối tuần`, `Cả nhóm đến ${place} bằng xe khách. ${filler(2)} Rời ${place} lúc chiều muộn.`);
    expect(place, [rel]);
    add('vi-names', PLACE_ACCENTED_QUERY[i] ? place : strip(place), [rel], {}, `Place name ${PLACE_ACCENTED_QUERY[i] ? 'with' : 'without'} diacritics.`);
  });

  // 10. Synonyms and abbreviations come from the lexicon file.
  SYNONYM.forEach(([group, title, sentence, query]) => {
    const forms = group.split(' = ');
    const rel = note(title, `${sentence} ${filler(2)}`);
    for (const f of forms.slice(1)) expect(f, []);
    add('vi-synonym', query, [rel], {}, `Lexicon group "${group}"; the note uses the first form, the query another.`);
  });
  ABBR.forEach(([abbr, full, title, sentence, query]) => {
    const rel = note(title, `${sentence} ${filler(2)}`);
    expectWord(abbr);
    add('vi-abbr', query, [rel], {}, `Lexicon: ${abbr} = ${full}; the note spells it out.`);
  });

  // 11. Aliases: the query matches only the alias in the front matter.
  ALIAS.forEach(([title, alias, body]) => {
    const rel = put(`notes/${title}.md`, `---\naliases:\n  - ${alias}\n---\n# ${title}\n\n${body}\n`);
    // The alias is in the front matter by design, so it is allowed to match its own note and nothing else.
    expect(alias, [rel]);
    add('vi-alias', strip(alias), [rel], {}, `Query is the alias "${alias}" without diacritics; body is English.`);
  });

  // 12. Filler, some with CRLF line endings.
  for (let k = 0; k < 110; k++) {
    const topic = pick(FILLER_TOPICS);
    const title = `Ghi chép ${String(k + 1).padStart(3, '0')} ${topic}`;
    const text = `# ${title}\n\n${filler(2)}\n\n${filler(3)}\n`;
    put(`notes/${title}.md`, chance(0.14) ? text.replaceAll('\n', '\r\n') : text);
  }

  // 13. Harder compounds (after the filler: they use no rng call, so the notes above do not change).
  let hardNote = 0;
  const hard = (body) => { hardNote++; return note(`Nhật ký ${String(hardNote).padStart(2, '0')}`, body); };
  HARD_COMPOUNDS.forEach(([a, b, form], i) => {
    const f = (k) => HARD_FILLER[(i + k) % HARD_FILLER.length];
    const phrase = `${a} ${b}`;
    const target = hard(`${f(0)} Hôm qua tôi có nói chuyện về ${phrase} với một người bạn. ${f(1)}`);
    hard(`${f(2)} Chuyện ${b} ${a} lại được nhắc tới. Ở đây ${a} thì nhiều, ${b} cũng vậy. ${f(3)} Lại ${b} rồi ${a}.`);
    hard(`${f(4)} ${cap(a)} và ${b} là hai chuyện riêng. Người ta bàn về ${b} ${a} cả buổi. Còn ${a} thì sao?`);
    hard(`${f(5)} Về ${b}: không rõ. Về ${a}: để sau. ${cap(b)} ${a}, ${b}.`);
    expect(phrase, [target]);
    foldChecks.push([phrase, target]);
    const query = form === 'folded' ? strip(phrase) : form === 'context' ? `nói chuyện ${phrase}` : phrase;
    add('vi-compound', query, [target], { hard: form },
      `Harder: the note has "${phrase}" once; three other notes have "${a}" and "${b}" more often, reversed or apart.`);
  });

  // 14. Cases of 0.12.0 (after all other notes, no rng calls). `cause` names the failure each one mirrors.
  const words = (text) => strip(nfc(text).toLowerCase()).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const pairsOf = (text) => { const w = words(text); return w.slice(1).map((x, i) => `${w[i]} ${x}`); };
  const isUnaccented = (n) => strip(n.text) === n.text;
  const later = [];   // checks that need every note
  const titled = (title, body) => note(title, body);
  for (let i = 0; i < COMMON_NOTES; i++)
    note(`Ghi việc tuần ${String(i + 1).padStart(2, '0')}`,
      `${COMMON_T[i % COMMON_T.length]} ${COMMON_W[(i + 1) % COMMON_W.length]}\n\n${COMMON_I[i % COMMON_I.length]} ${COMMON_P[(i + 2) % COMMON_P.length]}`);
  const withNear = (title, body, near) => { const rel = titled(title, body); for (const [t, b] of near) titled(t, b); return rel; };
  // Share of the notes that contain `phrase` as whole words.
  const docShare = (phrase) => {
    const re = new RegExp(`(^|[^\\p{L}])${nfc(phrase).toLowerCase()}([^\\p{L}]|$)`, 'u');
    return { docs: notes.filter((n) => re.test(n.text)).length, share: notes.filter((n) => re.test(n.text)).length / notes.length };
  };
  const common = (phrase, share) => later.push(() => {
    const d = docShare(phrase);
    if (!(d.docs >= 20 && d.share > share)) problems.push(`"${phrase}" is in ${d.docs} notes (${(100 * d.share).toFixed(1)}%), expected more than ${100 * share}%`);
  });

  IY_MIXED.forEach(([query, title, body, near]) => {
    const rel = withNear(title, body, near);
    const other = toI(query) !== query ? toI(query) : toY(query);
    expect(query, []); expect(other, [rel]);
    add('vi-iy', query, [rel], { cause: 'iy-mixed' },
      `The answer spells "${other}"; near notes on the topic use the query's spelling for part of the phrase.`);
  });
  COMMON_COMPOUND.forEach(([compound, rest, title, body, near]) => {
    const rel = withNear(title, body, near);
    const query = `${compound} ${rest}`;
    expect(query, []); common(compound, 0.1);
    add('vi-compound', query, [rel], { cause: 'common-compound' },
      `"${compound}" is in more than 10% of the notes; the answer has the other words, not as one phrase.`);
  });
  COMMON_ABBR.forEach(([abbr, full, query, title, body, near]) => {
    const rel = withNear(title, body, near);
    common(full, 0.05);
    later.push(() => {
      const re = new RegExp(`(^|[^\\p{L}])${abbr}([^\\p{L}]|$)`, 'u');
      const hit = notes.filter((n) => re.test(n.raw)).map((n) => n.path);
      if (hit.some((p) => p !== rel)) problems.push(`abbreviation "${abbr}" is written in ${JSON.stringify(hit.slice(0, 3))}`);
    });
    add('vi-abbr', query, [rel], { cause: 'common-abbr' },
      `Lexicon: ${abbr} = ${full}, a phrase in more than 5% of the notes; the answer ${nfc(body).includes(abbr) ? 'writes the abbreviation' : 'spells it out'}.`);
  });
  UNACCENTED_CHAT.forEach((body, i) => note(`Nhan nhanh ${String(i + 1).padStart(2, '0')}`, body));
  FUNCTION_PAIRS.forEach(([query, title, body, near]) => {
    const rel = withNear(title, body, [near]);
    expect(query, []);
    later.push(() => {
      const found = new Set(notes.filter(isUnaccented).flatMap((n) => pairsOf(n.raw)));
      if (!pairsOf(query).some((p) => found.has(p))) problems.push(`no pair of "${query}" is in an unaccented note`);
    });
    add('vi-accented', query, [rel], { cause: 'function-pairs' },
      'Unaccented notes share a function-word pair of the query; the answer is an accented note.');
  });
  FEW_UNACCENTED_PAIRS.forEach(([query, title, body, near]) => {
    const rel = withNear(title, body, [near]);
    later.push(() => {
      const n = notes.find((x) => x.path === rel);
      if (!isUnaccented(n)) problems.push(`${rel} is not typed without diacritics`);
      const found = new Set(notes.filter(isUnaccented).flatMap((x) => pairsOf(x.raw)));
      const pairs = pairsOf(query);
      const share = pairs.filter((p) => found.has(p)).length / pairs.length;
      if (!(share > 0 && share < 0.5)) problems.push(`"${query}": ${share} of its pairs are in unaccented notes, expected more than 0 and less than half`);
    });
    add('vi-accented', query, [rel], { cause: 'few-unaccented-pairs' },
      'The answer is typed without diacritics; fewer than half of the query word pairs occur unaccented in the vault.');
  });
  IDEA.forEach(([query, title, body, near]) => {
    const rel = withNear(title, body, near);
    add('vi-semantic', query, [rel], { cause: 'idea' },
      'Idea-style query; near notes share only its generic words, the answer none of its content words.');
  });
  TITLE_PHRASE.forEach(([query, title, body, narrowTitle, narrowBody]) => {
    const rel = titled(title, body);
    const narrow = titled(narrowTitle, narrowBody);
    expect(query, [rel, narrow]);
    if (nfc(title).toLowerCase().includes(query) || !nfc(narrowTitle).toLowerCase().includes(query)) throw new Error(`vi-search: title-phrase "${query}"`);
    add('vi-accented', query, [rel], { cause: 'title-phrase' },
      'The overview note answers the query; a narrow note with the phrase in its title is only partly relevant.');
    golden.at(-1).partial_paths = [narrow];
  });
  RARE_IDENTIFIER.forEach(([query, id, title, body, near]) => {
    const rel = withNear(title, body, near);
    expect(id, [rel]);
    add('vi-accented', query, [rel], { cause: 'rare-identifier' },
      `Only the answer has "${id}", once; near notes are about the general topic.`);
  });
  for (const [title, body] of TONELESS_IY_NEAR) titled(title, body);
  TONELESS_IY.forEach(([query, title, body]) => {
    const rel = titled(title, body);
    add('vi-mixed-en', query, [rel], { cause: 'toneless-iy' },
      'Unaccented query with a toneless i/y syllable; English notes and other notes use the other spelling as a word.');
  });
  for (const check of later) check();

  for (const [phrase, expected] of checks) expectNotes(phrase, expected);
  // The folded query must also identify one note only, or the query would be ambiguous even for a perfect fold.
  for (const [term, rel] of foldChecks) {
    const q = strip(term).toLowerCase();
    const found = notes.filter((n) => strip(n.text).includes(q)).map((n) => n.path);
    if (found.length !== 1 || found[0] !== rel) problems.push(`folded "${q}" is in ${JSON.stringify(found.slice(0, 3))}, expected only ${rel}`);
  }
  if (problems.length) throw new Error(`vi-search: golden set does not match the corpus:\n${problems.join('\n')}`);

  // 14. Lexicon (format fixed by the project: three sections, one group per line, joined by " = ").
  const compounds = [...new Set(COMPOUND_PAIRS.flatMap(([a, , b]) => [a, b]))];
  put('_ohs/lexicon.md', [
    '# Từ điển của vault', '',
    'Từ điển mẫu cho bộ kiểm thử tiếng Việt. Mỗi dòng là một nhóm, các dạng nối bằng dấu bằng.', '',
    '## Đồng nghĩa', '', ...SYNONYM.map(([g]) => g), '',
    '## Viết tắt', '', ...ABBR.map(([a, f]) => `${a} = ${f}`), ...COMMON_ABBR.map(([a, f]) => `${a} = ${f}`), '',
    '## Từ ghép', '', ...compounds, '',
    '## Chờ duyệt', '', 'GD = giáo dục', '',
  ].join('\n'));

  // Sanity: queries per category as queriesPer says.
  for (const c of categories) if (counts[c] !== queriesPer(c)) throw new Error(`vi-search: ${c} has ${counts[c]} queries, expected ${queriesPer(c)}`);
  if (golden.length !== categories.reduce((n, c) => n + queriesPer(c), 0)) throw new Error('vi-search: unexpected category in golden set');

  if (answersOut) files.outside = new Map([[answersOut, JSON.stringify(golden, null, 2) + '\n']]);
  return files;
}
