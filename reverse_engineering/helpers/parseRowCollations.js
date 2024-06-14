const COLLATION_CATEGORIES = {
	cs: 'caseSensitivity',
	ci: 'caseSensitivity',
	as: 'accentSensitivity',
	ai: 'accentSensitivity',
	ks: 'kanaSensitivity',
	ws: 'widthSensitivity',
	vss: 'variationSelectorSensitivity',
	bin: 'binarySort',
	bin2: 'binarySort',
	utf8: 'utf8',
	ps: 'punctuationSensitivity',
	pi: 'punctuationSensitivity',
	fl: 'firstLetterPreference',
	fu: 'firstLetterPreference',
	lower: 'caseConversion',
	upper: 'caseConversion',
	trim: 'spaceTrimming',
	ltrim: 'spaceTrimming',
	rtrim: 'spaceTrimming',
};

const LOCALE_COLLATION = 'locale';

const parseRowCollations = collationStatement => {
	if (!collationStatement) {
		return {};
	}

	return collationStatement.split('_').reduce(
		(collations, item) => {
			const category = COLLATION_CATEGORIES[item.toLowerCase()] || LOCALE_COLLATION;
			if (collations[category]) {
				if (category === LOCALE_COLLATION) {
					return {
						...collations,
						[category]: `${collations[category]}_${item}`,
					};
				}
				return collations;
			}

			return {
				...collations,
				[category]: item,
			};
		},
		{ collate: true },
	);
};

module.exports = parseRowCollations;
