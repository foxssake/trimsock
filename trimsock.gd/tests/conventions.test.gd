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
		check_type("should parse stream end", "cmd|1234\n", TrimsockCommand.Type.STREAM_FINISH, "1234")
		
		check_type("should parse raw request", "\rcmd?1234 4\n1234\n", TrimsockCommand.Type.REQUEST, "1234")
		check_type("should parse raw stream chunk", "\rcmd|01 4\n0123\n", TrimsockCommand.Type.STREAM_CHUNK, "01")
		check_type("should parse raw stream end", "\rcmd|01 0\n\n", TrimsockCommand.Type.STREAM_FINISH, "01")
	)

	define("Multiparam", func():
		check_params("should parse params", "cmd foo bar\n", ["foo", "bar"], [])
		check_params("should parse quoted params", "cmd \"foo bar\" \"quix baz\"\n", ["foo bar", "quix baz"], [])
		check_params("should parse mixed params", "cmd foo \"bar quix\" baz\n", ["foo", "bar quix", "baz"], [])
	)
	
	define("Key-value params", func():
		check_params("should parse pair", "cmd foo=bar\n", [], [["foo", "bar"]])
		check_params("should parse quoted-unquoted pair", "cmd \"foo bar\"=quix\n", [], [["foo bar", "quix"]])
		check_params("should parse unquoted-quoted pair", "cmd foo=\"bar quix\"\n", [], [["foo", "bar quix"]])
		check_params("should parse quoted pair", "cmd \"foo bar\"=\"quix baz\"\n", [], [["foo bar", "quix baz"]])
		check_params("should parse params before kv-pairs", "cmd foo bar quix=baz\n", ["foo", "bar"], [["quix", "baz"]])
		check_params("should parse params after kv-pairs", "cmd foo=bar quix baz\n", ["quix", "baz"], [["foo", "bar"]])
	)
	
	test("params should passthrough raw", func():
		reader.ingest_text("\rcmd 4\n1234\n")
		var command := reader.read()
		expect_not_null(command)
		expect(command.is_raw, "Command must be raw!")
		expect(not command.text, "Command should have no text!")
		expect_empty(command.chunks, "Command should have no chunks!")
		expect_empty(command.params, "Command should have no params!")
		expect_empty(command.kv_pairs, "Command should have no kv-pairs!")
		expect_empty(command.kv_map, "Command should have no kv-map!")
	)

func check_type(name: String, input: String, expected_type: TrimsockCommand.Type, expected_id: String) -> void:
	test(name, func():
		reader.ingest_text(input)

		var command := reader.read()
		expect_not_null(command, "Command was null!")
		expect_equal(
			TrimsockCommand.type_string(command.type), 
			TrimsockCommand.type_string(expected_type),
			"Command type mismatch!"
		)
		expect_equal(command.exchange_id, expected_id, "Command ID mismatch!")
	)

func check_params(name: String, input: String, expected_params: Array, expected_pairs: Array) -> void:
	test(name, func():
		reader.ingest_text(input)
		
		var command := reader.read()
		expect_not_null(command)
		expect_equal(command.params, expected_params, "Params did not match!")
		expect_equal(command.kv_pairs.map(func(it): return [it.key, it.value]), expected_pairs, "KV-pairs did not match!")
	)
