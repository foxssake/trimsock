extends VestTest

func get_suite_name():
	return "TrimsockLineReader"

var line_reader: _TrimsockLineReader

func suite():
	on_case_begin.connect(func(__):
		line_reader = _TrimsockLineReader.new()
	)

	define("read_line()", func():
		check_ingest("should read line", "command foo bar\n", "command foo bar")
		check_ingest("should skip unfinished", "command foo", "")
		check_ingests("should accumulate escape", ["command foo\\", "\" bar\n"], ["", "command foo\\\" bar"])
		check_ingests("should accumulate quote", ["command \"", "foo\nbar\"\n"], ["", "command \"foo\nbar\""])
		
		test("should read multiple", func():
			line_reader.ingest("command foo\ncommand bar\n".to_utf8_buffer())
			var expected := [
				"command foo",
				"command bar"
			]
			
			# Read all lines available
			var lines := []
			while true:
				var line := line_reader.read_text()
				if not line: break
				lines.append(line)

			# Check
			expect_equal(lines, expected)
		)
	)

# TODO(vest): Support test_* methods as regular methods
func check_ingests(name: String, chunks: Array, expected: Array) -> void:
	test(name, func():
		var results := []
		for i in range(chunks.size()):
			line_reader.ingest(str(chunks[i]).to_utf8_buffer())
			results.append(line_reader.read_text())
		expect_equal(results, expected)
	)

func check_ingest(name: String, chunk: String, expected: String) -> void:
	test(name, func():
		line_reader.ingest(chunk.to_utf8_buffer())
		expect_equal(line_reader.read_text(), expected)
	)
