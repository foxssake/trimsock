extends VestTest

func get_suite_name():
	return "RandomTrimsockIDGenerator"

func test_sequence():
	var generator := RandomTrimsockIDGenerator.new()
	var min_seq := 1_000_000
	var ids := {}
	
	benchmark("Generator", func(__):
		var id := generator.get_id()
		ids[id] = true
	)\
		.with_batch_size(1000)\
		.with_iterations(min_seq)\
		.run()

	expect(ids.size() >= min_seq, "Generator failed to produce %d unique IDs!" % min_seq)
