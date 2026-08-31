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

	define("raw data terminator", func():
		test("should read raw message split at its terminator", func():
			reader.ingest_text("\rcommand 4\n1234")
			expect_null(reader.read(), "Command was read without its terminator!")

			reader.ingest_text("\n")
			var command := reader.read()

			expect_not_null(command)
			expect_equal(command.raw, "1234".to_utf8_buffer())
		)

		test("should not emit a command for the terminator", func():
			reader.ingest_text("\rcommand 4\n1234\ncommand after\n")

			expect_equal(read_names(), ["command", "command"])
		)

		test("should reject raw data with a malformed terminator", func():
			reader.ingest_text("\rcommand 4\n1234X\n")

			expect_null(reader.read(), "Command was read!")
			expect_not_equal(reader.last_error, OK, "No error was reported!")
		)

		test("should keep parsing after a malformed terminator", func():
			# The malformed terminator is consumed in its place, so parsing
			# resumes on the next line
			reader.ingest_text("\rcommand 4\n1234Xcommand foo\n")
			expect_null(reader.read(), "Command was read!")

			expect_equal(read_names(), ["command"])
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
			expect_null(reader.read(), "Command was read!")
			expect_not_equal(reader.last_error, OK, "No error was reported!")

			reader.ingest_text("command foo\n")
			expect_equal(read_names(), ["command"])
		)

		test("should accept raw command sized up to max_size", func():
			reader.max_size = 16

			# 15 bytes of data plus the terminating newline exactly fill the buffer
			reader.ingest_text("\rcommand 15\n")
			expect_null(reader.read(), "Command was read without data!")

			reader.ingest_text("012345678901234\n")
			var command := reader.read()

			expect_not_null(command)
			expect_equal(command.raw, "012345678901234".to_utf8_buffer())
		)
	)

	define("buffer overflow", func():
		test("should reject data over max_size", func():
			reader.max_size = 8

			expect_not_equal(reader.ingest_text("command foobar\n"), OK)
		)

		test("should resume parsing after discarding the buffer", func():
			reader.max_size = 16

			reader.ingest_text("012345678901")
			expect_null(reader.read(), "Command was read!")

			expect_not_equal(reader.ingest_text("01234"), OK, "No overflow!")

			reader.ingest_text("command\n")
			expect_equal(read_names(), ["command"])
		)

		test("should reset quote state after discarding the buffer", func():
			reader.max_size = 16

			reader.ingest_text("\"")
			expect_null(reader.read(), "Command was read!")

			expect_not_equal(reader.ingest_text("0123456789012345"), OK, "No overflow!")

			reader.ingest_text("command foo\n")
			expect_equal(read_names(), ["command"])
		)

		test("should drop queued raw command after discarding the buffer", func():
			reader.max_size = 16

			reader.ingest_text("\rcommand 8\n")
			expect_null(reader.read(), "Command was read without data!")

			expect_not_equal(reader.ingest_text("0".repeat(17)), OK, "No overflow!")

			reader.ingest_text("command foo\n")
			expect_equal(read_names(), ["command"])
		)
	)

func check_invalid_raw(name: String, input: String) -> void:
	test("should reject raw command with " + name, func():
		reader.ingest_text(input)

		expect_null(reader.read(), "Command was read!")
		expect_not_equal(reader.last_error, OK, "No error was reported!")
	)

# Read all the commands available and return their names
func read_names() -> Array:
	var names := []
	while true:
		var command := reader.read()
		if not command: break
		names.append(command.name)

	return names
