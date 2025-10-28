extends VestTest

var commands := [
	TrimsockCommand.request("whereami"),
	TrimsockCommand.request("session/set-game-id").with_params(["RghrnyJK0mUA7cW05fCKo"]),
	TrimsockCommand.request("lobby/create").with_params([ "noray://example.com:8890/Q9VKjXiAlwVK" ]).with_kv_map({ "name": "Cool Lobby" }),
	TrimsockCommand.request("lobby/lock").with_text("YuDqpQovXvpc"),
	TrimsockCommand.request("lobby/delete").with_text("YuDqpQovXvpc")
] as Array[TrimsockCommand]

func get_suite_name():
	return "TrimsockCommand"

func suite():
	test("Serialization", func():
		var idx := 0
		var peer := StreamPeerBuffer.new()

		benchmark("Predefined commands", func(__):
			commands[idx].serialize_to_stream(peer)
			peer.data_array.clear()
			idx = (idx + 1) % commands.size()
		)\
			.with_duration(4.0)\
			.with_batch_size(512)\
			.run()
	)
