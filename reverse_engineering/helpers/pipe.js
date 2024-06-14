module.exports =
	(...functions) =>
	x =>
		functions.reduce((v, f) => f(v), x);
