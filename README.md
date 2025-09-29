# Trimsock

Trimsock is a stream-based communication protocol that:

* is easy to implement
* is human-readable
* supports binary
* is extended via conventions

Simple: `command data\n`
Embedded nl: `"com\n\"mand" "da\nta"\n`
Multiple params: `command param1 "param 2"\n`
Key-value params: `command key1=value1 "key with =="="value 2" "not a key=value pair"\n`

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
[Specification](#specification).

## Use case

Trimsock aims to fill the niche of a bi-directional, structured protocol, while
being easy to understand and implement.

This could mean, among others, adapting a TCP socket for native applications,
or sitting on top of WebSockets, providing structure.

## Implementations

Anyone is free to implement the trimsock protocol. This repository hosts
reference implementations in different languages.

- [trimsock.js](./trimsock.js)

## Specification

> [!WARNING]  
> The specification is still work in progress

### Core

Implementing the core specification is enough for conformance. Additional
features may be built on top of it as conventions.

#### Commands

Trimsock exchanges *commands*, with each *command* consisting of the *command
name*, a single space, the *command data* and a single newline character,
delimiting the command:

```
[command name] [command data]\n
```

An example command:

```
login tom@acme.com:ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
```

A *command* may omit the *command data*:

```
[command name]\n
```

Without *command data*, the space character is not needed.

> [!NOTE]
> Technically - while not useful - `\n` is a valid command, with both the
> command name and data being an empty string.

*Commands* MUST be parsed as UTF-8 strings.

#### Data chunks

Command data may be specified in multiple chunks. A chunk is either a regular
string, or a quoted string.

A regular string can contain any other character, except `"`. Those may be
escaped as `\"`.

Quoted strings are enclosed in `"` characters.

For example:

```
command chunk one "chunk two" chunk three\n
```

In this case, the command would have three chunks:

- `chunk one `
- `chunk two`
- ` chunk three`

Note the spaces at the end and beginning of the regular chunks.

Chunk don't change the meaning of the command data, but they may be used by
*conventions* for semantics.

Meaning that the previous example is - without considering conventions -
equivalent to the following:

```
command chunk one chunk two chunk three\n
```

#### Escape sequences

Both the *command name* and *command data* may want to encode characters that
are otherwise used for the protocol itself, e.g. newlines. In these cases,
these special characters are *escaped* based on the following table:

| Character | Character byte | Escape sequence | Escape bytes |
|-----------|----------------|-----------------|--------------|
| `\n`      | `0x0A`         | `\\n`           | `0x5C 0x6E`  |
| `\r`      | `0x0D`         | `\\r`           | `0x5C 0x72`  |
| ` `       | `0x20`         | `\\s`           | `0x5C 0x73`  |

During parsing, these escape sequences must be replaced with their original
counterparts.

The space character's escape sequence is only recognized in the *command name*.
In command data, the `\\s` character sequence is left as-is.

#### Reserved characters in command names

The conventions described later on use certain characters to encode extra
information in command names. To avoid conflicting with these, implementations
SHOULD NOT use the following characters in command names, unless implementing a
convention that requires it:

- `?`
- `.`
- `!`
- `|`
- `$`

#### Raw data

In some cases, it can be beneficial to send larger chunks of data without
escaping and unescaping the *command data*.

In these cases, commands with *raw data* may be sent, with the following
format:

```
\r[command name] [data size in bytes]\n
[raw data]\n
```

Example:

```
\rset-picture 1524\n
\xFF\xD8\xFF\xE1\x00\x18\x45\x78\x69\x66\x00\x00\x49\x49...\n
```

Raw data MUST be interpreted as-is, without any kind of decoding algorithm (
i.e. don't parse it as UTF-8 ).

### Conventions

Conventions build on top of the base specifications. They do so in a way that
produces commands still adhering to the base specification. In other words, if
a given implementation does not recognize a given convention, it can still at
least parse the convention's commands.

#### Multiple command parameters

In case a command needs multiple parameters instead of a single *command data*
blob, implementations may split the *command data* into multiple *command
parameters*.

This is done by splitting the *command data* at every space character:

```
[command name] [command parameter] [command parameter] [...]\n
```

For example:

```
set-user-details Tom Acme tom@acme.com
```

For this conventions, implementations MUST recognize the following escape
sequence:

| Character | Escape sequence | Byte sequence (hexadecimal) |
|-----------|-----------------|-----------------------------|
| ` `       | `\\s`           | `0x5C 0x73`                 |

This allows *command parameters* to contain space characters.

Conforming implementations MUST NOT parse *raw command data* as multiple
parameters.

#### Request-response pairs

A common use case is requesting some data, and then receiving it in a response
message.

To support this, *command names* may be extended with a *request id* that
uniquely identifies the request-response exchange:

```
[command name]?[request-id] [command data]\n
```

This initiates a request with the given ID. Later commands can use this ID to
uniquely identify the request they're responding to.

Note that to an implementation that does not handle request-response pairs,
this is still a valid command.

The *request ID* must be a string unique to the connection. Implementations are
free to choose their own approach, for example sequential IDs, [UUIDs], or
[nanoids].

Once a request is received, a response MUST be sent with the same request ID.
If the request was successfully processed, send a *success response* in the
following form:

```
.[request-id] [command data]\n
```

If the request cannot be processed, send an *error response*:

```
![request-id] [command data]\n
```

The contents of the *command data* are entirely up to the application - among
others, it can be used to indicate why the request wasn't processed.

For every request, only a single response MUST be sent. Further responses MUST NOT
be considered. Implementations MAY discard further responses, or they MAY raise
an error. Implementations MAY reuse request ID's, as long as that causes no
ambiguity.

An example request-response flow:

```
>>> login?pDYqh3ghn241 tom@acme.com:3dff73672811dcd9f93f3dd86ce4e04960b46e10827a55418c7cc35d596e9662\n
>>> !pDYqh3ghn241 Wrong password!
>>> login?i6QhjOtphK2m tom@acme.com:ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f\n
<<< .i6QhjOtphK2m OK\n
```

The response commands SHOULD NOT contain the original command name.
Implementations are free to ignore the command name, as they only rely on the
request ID. Which means that this is a valid exchange as well:

```
>>> login?pDYqh3ghn241 tom@acme.com:3dff73672811dcd9f93f3dd86ce4e04960b46e10827a55418c7cc35d596e9662\n
>>> login!pDYqh3ghn241 Wrong password!
>>> login?i6QhjOtphK2m tom@acme.com:ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f\n
<<< login.i6QhjOtphK2m OK\n
```

#### Streaming

Large amounts of data can be impractical to transmit in one large *command*.
Instead, multiple commands are sent in order, each with a chunk of the full
data.

Streams may be initiated by the sender, or sent in response to a request.

When initiated by the sender, the first message MUST denote the *command name*
and the *stream ID*, along with the first data chunk:

```
[command name]|[stream-id] [data chunk]\n
```

If the stream is initiated in response to a request, the request ID MUST be
used as the stream ID. The command name MUST NOT be included:

```
|[stream-id] [data chunk]\n
```

This first command is also used to transmit the first chunk of data.

From here, each data chunk is sent in the same format:

```
|[stream-id] [data chunk]\n
```

Once all the data has been sent, the stream MUST be terminated with an empty
data chunk:

```
|[stream-id] \n
```

An example stream exchange, combined with request-response pairs:

```
>>> get-file|AUygn0OwMgYu big-video.mp4
<<< |AUygn0OwMgYu \b1024...\n
<<< |AUygn0OwMgYu \b1024...\n
<<< |AUygn0OwMgYu \b1024...\n
<<< |AUygn0OwMgYu \n
```

>[!NOTE]
> While the [Request-response pairs] convention specifies that only one
> *response command* can be sent for a request, *stream commands* are exempt from
> this rule, with the virtue of being a different kind of command.


[C escape sequences]: https://en.wikipedia.org/wiki/Escape_sequences_in_C#Escape_sequences
[UUIDs]: https://en.wikipedia.org/wiki/Universally_unique_identifier
[nanoids]: https://github.com/ai/nanoid
[Request-response pairs]: #request-response-pairs
