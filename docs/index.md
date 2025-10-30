# Trimsock

Trimsock is a stream-based communication protocol that:

* is easy to implement
* is human-readable
* supports binary
* is extended via conventions

## Quick glance

Trimsock uses commands to transmit instructions, e.g.:

```
>>> login tom@acme.com:ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
<<< set-sessionid ZcLpOdmxgQf9
```

Each command consists of a *name*, a space, *data*, and a terminating newline.

It can also do *request-response pairs*, by encoding a request ID in the command name:

```
>>> login?pDYqh3ghn241 tom@acme.com:3dff73672811dcd9f93f3dd86ce4e04960b46e10827a55418c7cc35d596e9662\n
>>> !pDYqh3ghn241 Wrong password!
>>> login?i6QhjOtphK2m tom@acme.com:ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f\n
<<< .i6QhjOtphK2m OK\n
```

This way, responses can indicate whether the request was successful or not.

For responses with many items, Trimsock also supports *streams* in a similar manner:

```
>>> lobbies?qX42w1PfY9Sq
<<< |qX42w1PfY9Sq 50UPmO6lk4Uq Cool\sLobby
<<< |qX42w1PfY9Sq C7Yfk3UP07Ag Dave's\sGarage\sMatches
<<< |qX42w1PfY9Sq MV1oLTkTPwTS casual\sgang
<<< |qX42w1PfY9Sq 
```

The protocol also supports multiple parameters per command, and raw messages
for transmitting binary. Find out more from the
[Specification].

## Use case

Trimsock aims to fill the niche of a bi-directional, structured protocol, while
being easy to understand and implement.

This could mean, among others, adapting a TCP socket for native applications,
or sitting on top of WebSockets, providing structure.


[Specification]: #
