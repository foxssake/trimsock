extends VestTest

func get_suite_name():
	return "Reactor"

var reactor: TestingReactor

var some_source := 0
var other_source := 1

func suite():
	on_case_begin.connect(func(__):
		reactor = TestingReactor.new()
		reactor.attach(some_source)
		reactor.attach(other_source)
	)

	test("should call handler", func():
		var commands := []
		var handler := func(cmd):
			commands.append(cmd)
		reactor.on("command", handler)
		
		reactor.ingest_text(some_source, "command foo\n")
		reactor.poll()
		
		expect_not_empty(commands)
	)
	
	test("should handle unknown", func():
		var commands := []
		var handler := func(cmd):
			commands.append(cmd)
			reactor.send(some_source, TrimsockCommand.simple("error"))
		reactor.on_unknown(handler)
		
		reactor.ingest_text(some_source, "unknown foo\n")
		reactor.poll()
		
		expect_not_empty(commands, "No commands handled!")
		expect_not_empty(reactor.outbox, "No commands sent!")
	)
