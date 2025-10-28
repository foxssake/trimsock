extends VestTest

const COMMANDS := [
  "whereami?\n",
  "session/set-game-id RghrnyJK0mUA7cW05fCKo\n",
  "lobby/create? noray://example.com:8890/Q9VKjXiAlwVK name=\"Cool Lobby\"\n",
  "lobby/lock? YuDqpQovXvpc",
  "lobby/delete? YuDqpQovXvpc"
]

func get_suite_name():
	return "TrimsockReader"

func suite():
	var reader := TrimsockReader.new()
	var idx := 0

	test("Parsing", func():
		benchmark("Predefined commands", func(__):
			reader.ingest_text(COMMANDS[idx])
			while reader.read() != null:
				pass
			idx = (idx + 1) % COMMANDS.size()
		)\
			.with_duration(4.)\
			.with_batch_size(128)\
			.run()
	)
