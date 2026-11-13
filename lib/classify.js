// Conservative keyword refinement for items from general "news" feeds.
// Only moves an item when the title clearly matches a topic; otherwise keeps the feed's topic.
const W = (re) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${re.source})(?![\\p{L}\\p{N}])`, 'iu');
const RULES = [
  ['sports', W(/football|soccer|premier league|champions league|world cup|olympic|tennis|cricket|nba|nfl|fifa|grand prix|formula 1|f1|rugby|golf|marathon|v-league|sea games|asiad|bóng đá|thể thao|đội tuyển|huấn luyện viên|fußball|bundesliga|ligue 1/)],
  ['business', W(/stocks?|stock market|inflation|gdp|central bank|interest rates?|tariffs?|economy|economic|earnings|ipo|exports?|imports?|trade deal|chứng khoán|lãi suất|lạm phát|kinh tế|doanh nghiệp|xuất khẩu|giá vàng|wirtschaft|économie/)],
  ['tech', W(/ai|artificial intelligence|chip|semiconductor|smartphone|iphone|software|cyber|hacker|startup|robot|tech|công nghệ|trí tuệ nhân tạo|bán dẫn/)],
  ['science', W(/nasa|space|rocket|satellite|scientists?|researchers?|climate|species|fossil|khoa học|vũ trụ|tên lửa đẩy/)],
  ['health', W(/hospital|vaccine|virus|disease|cancer|outbreak|covid|dengue|health|bệnh viện|vắc xin|sốt xuất huyết|dịch bệnh|sức khỏe/)],
  ['culture', W(/film|movie|festival|music|concert|album|actor|actress|museum|oscar|k-pop|kpop|phim|ca sĩ|âm nhạc|lễ hội|triển lãm/)],
];

function refineTopic(item) {
  if (item.t !== 'news') return item.t;
  for (const [topic, re] of RULES) if (re.test(item.ti)) return topic;
  return item.t;
}

module.exports = { refineTopic };
