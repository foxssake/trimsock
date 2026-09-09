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
		var command := reader.read().value()

		expect_not_null(command)
		expect_true(command.is_raw)
		expect_equal(command.raw, "a\ncd".to_utf8_buffer())
	)

	define("raw data terminator", func():
		test("should read raw message split at its terminator", func():
			reader.ingest_text("\rcommand 4\n1234")
			expect_null(reader.read().value(), "Command was read without its terminator!")

			reader.ingest_text("\n")
			var command := reader.read().value()

			expect_not_null(command)
			expect_equal(command.raw, "1234".to_utf8_buffer())
		)

		test("should not emit a command for the terminator", func():
			reader.ingest_text("\rcommand 4\n1234\ncommand after\n")

			expect_equal(read_names(), ["command", "command"])
		)

		test("should reject raw data with incorrect size", func():
			reader.ingest_text("\rinvalid-command 4\n1234X\n")

			var result := reader.read()
			expect_null(result.value(), "Command was read!")
			expect_error(result.error(), ERR_PARSE_ERROR)
		)

		test("should keep parsing after a malformed terminator", func():
			# The malformed terminator "X" is consumed in its place, so parsing
			# resumes on the next line
			reader.ingest_text("\rinvalid-command 4\n1234Xvalid-command foo\n")
			expect_null(reader.read().value(), "Command was read!")

			expect_equal(read_names(), ["valid-command"])
		)
	)

	define("unsatisfiable raw commands", func():
		check_invalid_raw("missing size", "\rcommand\n")
		check_invalid_raw("non-numeric size", "\rcommand foo\n")
		check_invalid_raw("blank line", "\r\n")
		check_invalid_raw("negative size", "\rcommand -4\n")
		check_invalid_raw("size over max_size", "\rcommand 100000\n")
		check_invalid_raw("size just over max_size", "\rcommand 16385\n")
		# The terminating newline wouldn't fit in the buffer
		check_invalid_raw("size at max_size", "\rcommand 16384\n")

		test("should keep parsing after rejecting a raw command", func():
			reader.ingest_text("\r\n")
			var result := reader.read()
			expect_null(result.value(), "Command was read!")
			expect_error(result.error(), ERR_INVALID_DATA)

			reader.ingest_text("command foo\n")
			expect_equal(read_names(), ["command"])
		)

		test("should accept raw command sized up to max_size", func():
			reader.max_size = 16

			# 15 bytes of data plus the terminating newline exactly fill the buffer
			reader.ingest_text("\rcommand 15\n")
			expect_null(reader.read().value(), "Command was read without data!")

			reader.ingest_text("012345678901234\n")
			var command := reader.read().value()

			expect_not_null(command)
			expect_equal(command.raw, "012345678901234".to_utf8_buffer())
		)
	)

	define("buffer overflow", func():
		test("should reject data over max_size", func():
			reader.max_size = 8

			expect_error(reader.ingest_text("command foobar\n").error(), ERR_OUT_OF_MEMORY)
		)

		test("should resume parsing after discarding the buffer", func():
			reader.max_size = 16

			reader.ingest_text("012345678901")
			expect_null(reader.read().value(), "Command was read!")

			expect_error(reader.ingest_text("01234").error(), ERR_OUT_OF_MEMORY)

			reader.ingest_text("command\n")
			expect_equal(read_names(), ["command"])
		)

		test("should reset quote state after discarding the buffer", func():
			reader.max_size = 16

			reader.ingest_text("\"")
			expect_null(reader.read().value(), "Command was read!")

			expect_error(reader.ingest_text("0123456789012345").error(), ERR_OUT_OF_MEMORY)

			reader.ingest_text("command foo\n")
			expect_equal(read_names(), ["command"])
		)

		test("should drop queued raw command after discarding the buffer", func():
			reader.max_size = 16

			reader.ingest_text("\rcommand 8\n")
			expect_null(reader.read().value(), "Command was read without data!")

			expect_error(reader.ingest_text("0".repeat(17)).error(), ERR_OUT_OF_MEMORY)

			reader.ingest_text("command foo\n")
			expect_equal(read_names(), ["command"])
		)
	)

func check_invalid_raw(name: String, input: String) -> void:
	test("should reject raw command with " + name, func():
		reader.ingest_text(input)

		var result := reader.read()
		expect_null(result.value(), "Command was read!")
		expect_error(result.error(), ERR_INVALID_DATA)
	)

# Assert that the reported error has the specified error code
func expect_error(error: TrimsockResult.ErrorData, code: Error) -> void:
	expect_not_null(error, "No error was reported!")

	if error:
		expect_equal(error.code, code, "Reported %s instead of %s!" \
			% [error_string(error.code), error_string(code)])

# Read all the commands available and return their names
func read_names() -> Array:
	var names := []
	while true:
		var command := reader.read().value()
		if not command: break
		names.append(command.name)

	return names
