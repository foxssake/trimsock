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
		var handler := func(cmd, xchg):
			commands.append(cmd)
		reactor.on("command", handler)
		
		reactor.ingest_text(some_source, "command foo\n")
		reactor.poll()
		
		expect_not_empty(commands)
	)
	
	test("should handle unknown", func():
		var commands := []
		var handler := func(cmd, xchg):
			commands.append(cmd)
			reactor.send(some_source, TrimsockCommand.simple("error"))
		reactor.on_unknown(handler)
		
		reactor.ingest_text(some_source, "unknown foo\n")
		reactor.poll()
		
		expect_not_empty(commands, "No commands handled!")
		expect_not_empty(reactor.outbox, "No commands sent!")
	)
	
	test("should route to exchange", func():
		var commands := []
		var handler := func(cmd: TrimsockCommand, xchg: TrimsockExchange):
			commands.append(cmd)
			while xchg.is_open():
				commands.append(await xchg.read())
		reactor.on("command", handler)
		
		reactor.ingest_text(some_source, "command|1 foo\ncommand|1 bar\n")
		reactor.poll()
		
		expect_equal(commands.size(), 2)
	)
	
	test("should reply with handler return value", func():
		var commands := []
		var handler := func(cmd, xchg):
			commands.append(cmd)
			return TrimsockCommand.simple("response")
		reactor.on("command", handler)
		
		reactor.ingest_text(some_source, "command foo\n")
		reactor.poll()
		
		expect_equal(commands.size(), 1)
		expect_equal(reactor.outbox[0].target, some_source)
		expect_equal(reactor.outbox[0].command, TrimsockCommand.simple("response"))
	)

	test("should fill ID on request", func():
		var command := TrimsockCommand.simple("request")
		command.exchange_id = ""
		
		reactor.request(some_source, command)
		
		expect(reactor.outbox[0].command.is_request(), "Command was not a request!")
		expect_not_empty(reactor.outbox[0].command.exchange_id, "Request ID was empty!")
	)
	test("should fill ID on stream", func(): 
		var command := TrimsockCommand.simple("stream", "foo")
		command.exchange_id = ""
		
		reactor.stream(some_source, command)
		
		expect(reactor.outbox[0].command.is_stream(), "Command was not a stream!")
		expect_not_empty(reactor.outbox[0].command.exchange_id, "Stream ID was empty!")
	)
