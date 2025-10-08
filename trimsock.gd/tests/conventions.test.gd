extends VestTest

func get_suite_name():
	return "Conventions"

var reader: TrimsockReader

func suite():
	on_case_begin.connect(func(__):
		reader = TrimsockReader.new()
	)
	
	define("Request types", func():
		check_type("should parse request", "cmd?1234 foo\n", TrimsockCommand.Type.REQUEST, "1234")
		check_type("should parse success", ".1234 foo\n", TrimsockCommand.Type.SUCCESS_RESPONSE, "1234")
		check_type("should parse error", "!1234 foo\n", TrimsockCommand.Type.ERROR_RESPONSE, "1234")
		check_type("should parse stream chunk", "cmd|1234 foo\n", TrimsockCommand.Type.STREAM_CHUNK, "1234")
		check_type("should parse stream end", "cmd|1234\n", TrimsockCommand.Type.STREAM_FINSIH, "1234")
	)
	
	define("Params", func():
		check_params("should parse params", "cmd foo bar\n", ["foo", "bar"], [])
	)

func check_type(name: String, input: String, expected_type: TrimsockCommand.Type, expected_id: String) -> void:
	test(name, func():
		reader.ingest_text(input)

		var command := reader.read()
		expect_not_null(command)
		expect_equal(command.type, expected_type)
		expect_equal(command.exchange_id, expected_id)
	)

func check_params(name: String, input: String, expected_params: Array, expected_pairs: Array) -> void:
	test(name, func():
		reader.ingest_text(input)
		
		var command := reader.read()
		expect_not_null(command)
		expect_equal(command.params, expected_params)
	)
