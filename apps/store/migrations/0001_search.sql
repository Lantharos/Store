CREATE VIRTUAL TABLE `search` USING fts5(
  `key` UNINDEXED,
  `name`,
  `summary`,
  `keywords`,
  `developer`,
  tokenize = 'trigram remove_diacritics 1'
);
