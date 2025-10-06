extends VestTest

func get_suite_name():
	return "TrimsockLineParser"

var line_parser: _TrimsockLineParser

func suite():
	on_case_begin.connect(func(__):
		line_parser = _TrimsockLineParser.new()
	)

	define("name parsing", func():
		check_name("should parse simple name", "command ", "command")
		check_name("should parse quoted name", "\"foo bar\" ", "foo bar")
		check_name("should unescape simple name", "c\\nd", "c\nd")
		check_name("should unescape quoted name", '"\\"command\\""', '"command"')
	)

func check_name(name: String, input: String, expected_name: String) -> void:
	test(name, func():
		var cmd := line_parser.parse(input)
		
		expect_equal(cmd.name, expected_name)
		expect_empty(cmd.chunks)
		expect_empty(cmd.raw)
		expect_false(cmd.is_raw)
	)
