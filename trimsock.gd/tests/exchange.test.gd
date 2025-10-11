extends VestTest

func get_suite_name():
	return "Exchange"

var source := "foo"
var reactor: TestingReactor
var command: TrimsockCommand
var to_send: TrimsockCommand
var exchange: TrimsockExchange

func suite() -> void:
	on_case_begin.connect(func(__):
		reactor = TestingReactor.new()
		reactor.attach(source)

		command = TrimsockCommand.simple("command", "foo")
		to_send = TrimsockCommand.simple("test")
		exchange = TrimsockExchange.new(command, source, reactor)
	)

	define("Write", func():
		define("send()", func():
			test("should succeed", func():
				expect_true(exchange.send(to_send), "Send failed!")
				expect(reactor.has_sent_command(source, to_send), "Command was not sent!")
			)
			
			test("should fail after close", func():
				exchange.close()
				expect_false(exchange.send(to_send), "Send failed!")
				expect_not(reactor.has_sent_command(source, to_send), "Command was not sent!")
			)
		)
		
		define("send_and_close()", func():
			test("should close", func():
				expect_true(exchange.send_and_close(to_send), "Send failed!")
				expect(reactor.has_sent_command(source, to_send), "Command was not sent!")
				expect_not(exchange.is_open(), "Exchange wasn't closed!")
			)
			
			test("should fail if closed", func():
				exchange.close()
				expect_false(exchange.send_and_close(to_send), "Send succeeded!")
				expect_not(reactor.has_sent_command(source, to_send), "Command was sent!")
			)
		)
		
		define("reply()", func():
			test("should close", func():
				command.as_request()

				expect_true(exchange.reply(to_send), "Send failed!")
				expect_not_empty(reactor.outbox, "No command was sent!")

				var sent := reactor.outbox.front() as TrimsockCommand
				expect(sent.is_success(), "Command type mismatch!")
				expect_equal(sent.exchange_id, command.exchange_id, "ID mismatch!")
			)
			
			test("should fail if closed", func():
				command.as_request()

				exchange.close()
				expect_false(exchange.reply(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)

			test("should fail if not request", func():
				command.as_success_response()

				exchange.close()
				expect_false(exchange.reply(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)
		)
		
		define("fail()", func():
			test("should close", func():
				command.as_request()

				expect_true(exchange.fail(to_send), "Send failed!")
				expect_not_empty(reactor.outbox, "No command was sent!")

				var sent := reactor.outbox.front() as TrimsockCommand
				expect(sent.is_error(), "Command type mismatch!")
				expect_equal(sent.exchange_id, command.exchange_id, "ID mismatch!")
			)
			
			test("should fail if closed", func():
				command.as_request()

				exchange.close()
				expect_false(exchange.fail(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)

			test("should fail if not request", func():
				command.as_success_response()

				exchange.close()
				expect_false(exchange.fail(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)
		)
		
		define("stream()", func():
			test("should close", func():
				command.as_request()

				expect_true(exchange.stream(to_send), "Send failed!")
				expect_not_empty(reactor.outbox, "No command was sent!")

				var sent := reactor.outbox.front() as TrimsockCommand
				expect(sent.is_stream_chunk(), "Command type mismatch!")
				expect_equal(sent.exchange_id, command.exchange_id, "ID mismatch!")
			)
			
			test("should fail if closed", func():
				command.as_request()

				exchange.close()
				expect_false(exchange.stream(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)

			test("should fail if not request", func():
				command.as_success_response()

				exchange.close()
				expect_false(exchange.stream(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)
		)
		
		define("stream_finish()", func():
			test("should close", func():
				command.as_request()

				expect_true(exchange.stream_finish(to_send), "Send failed!")
				expect_not_empty(reactor.outbox, "No command was sent!")

				var sent := reactor.outbox.front() as TrimsockCommand
				expect(sent.is_stream_chunk(), "Command type mismatch!")
				expect(sent.is_empty(), "Command was not empty!")
				expect_equal(sent.exchange_id, command.exchange_id, "ID mismatch!")
			)
			
			test("should fail if closed", func():
				command.as_request()

				exchange.close()
				expect_false(exchange.stream_finish(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)

			test("should fail if not request", func():
				command.as_success_response()

				exchange.close()
				expect_false(exchange.stream_finish(to_send), "Send succeeded!")
				expect_empty(reactor.outbox, "Command was sent!")
			)
		)
	)
	
	define("Session", func():
		test("should get reactor's session", func():
			var session := "session"
			reactor.set_session(source, session)
			expect_equal(exchange.session(), session, "Exchange's session didn't match!")
			expect_equal(reactor.get_session(source), session, "Reactor's session didn't match!")
		)

		test("should set reactor's session", func():
			var session := "session"
			exchange.set_session(session)
			expect_equal(exchange.session(), session, "Exchange's session was not set!")
			expect_equal(reactor.get_session(source), session, "Reactor's session was not set!")
		)
	)
