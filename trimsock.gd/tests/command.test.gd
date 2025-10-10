extends VestTest

func get_suite_name():
	return "Command"

func suite():
	define("serialize", func():
		define("name", func():
			check_serialized("simple name", TrimsockCommand.simple("command"), "command\n")
			check_serialized("quote name", TrimsockCommand.simple("command name"), "\"command name\"\n")
			check_serialized("raw", TrimsockCommand.simple("command").as_raw(), "\rcommand 0\n\n")
			check_serialized("raw quoted", TrimsockCommand.simple("command name").as_raw(), "\r\"command name\" 0\n\n")
		)
		
		define("request-response", func():
			check_serialized("request", TrimsockCommand.request("command", "1234"), "command?1234\n")
			check_serialized("success", TrimsockCommand.success_response("command", "1234"), "command.1234\n")
			check_serialized("error", TrimsockCommand.error_response("command", "1234"), "command!1234\n")
			check_serialized("stream", TrimsockCommand.stream_chunk("command", "1234"), "command|1234\n")
			
			check_serialized("success without name", TrimsockCommand.success_response("", "1234"), ".1234\n")
			check_serialized("error without name", TrimsockCommand.error_response("", "1234"), "!1234\n")
			check_serialized("stream without name", TrimsockCommand.stream_chunk("", "1234"), "|1234\n")
		)
		
		define("multiparam", func():
			check_serialized("simple params", TrimsockCommand.simple("command").with_params(["foo", "bar"]), "command foo bar\n")
			check_serialized("quote params", TrimsockCommand.simple("command").with_params(["foo bar", "quix"]), "command \"foo bar\" quix\n")
		)
		
		define("kv-params", func():
			check_serialized("simple", TrimsockCommand.simple("command").with_kv_pairs([TrimsockCommand.pair_of("foo", "bar")]), "command foo=bar\n")
			check_serialized("quoted", TrimsockCommand.simple("command").with_kv_pairs([TrimsockCommand.pair_of("foo bar", "quix baz")]), "command \"foo bar\"=\"quix baz\"\n")
			check_serialized("key-quoted", TrimsockCommand.simple("command").with_kv_pairs([TrimsockCommand.pair_of("foo bar", "quix")]), "command \"foo bar\"=quix\n")
			check_serialized("value-quoted", TrimsockCommand.simple("command").with_kv_pairs([TrimsockCommand.pair_of("foo", "quix baz")]), "command foo=\"quix baz\"\n")
			check_serialized("with params", TrimsockCommand.simple("command").with_kv_pairs([TrimsockCommand.pair_of("foo", "bar")]).with_params(["foo", "bar"]), "command foo bar foo=bar\n")
		)
		
		define("kv-map", func():
			check_serialized("simple", TrimsockCommand.simple("command").with_kv_map({ "foo": "bar" }), "command foo=bar\n")
			check_serialized("quoted", TrimsockCommand.simple("command").with_kv_map({ "foo bar": "quix baz"}), "command \"foo bar\"=\"quix baz\"\n")
			check_serialized("key-quoted", TrimsockCommand.simple("command").with_kv_map({ "foo bar": "quix" }), "command \"foo bar\"=quix\n")
			check_serialized("value-quoted", TrimsockCommand.simple("command").with_kv_map({ "foo": "quix baz"}), "command foo=\"quix baz\"\n")
			check_serialized("with params", TrimsockCommand.simple("command").with_kv_map({ "foo": "bar" }).with_params(["foo", "bar"]), "command foo bar foo=bar\n")
		)
	)

func check_serialized(name: String, command: TrimsockCommand, expected_line: String) -> void:
	test(name, func():
		expect_equal(command.serialize().get_string_from_utf8(), expected_line)
	)
