extends VestTest

func get_suite_name():
	return "TrimsockReader"

var reader: TrimsockReader

func suite():
	on_case_begin.connect(func(__):
		reader = TrimsockReader.new()
	)

	test("should read raw message", func():
		ok()
		reader.ingest_text("\rcommand 4\na\ncd\n")
		var command := reader.read()

		expect_not_null(command)
		expect_true(command.is_raw)
		expect_equal(command.raw, "a\ncd".to_utf8_buffer())
	)
