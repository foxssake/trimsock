extends RefCounted
class_name TrimsockResult

## Represents the result of a trimsock operation
##
## If the call was successful, this instance will store the resulting
## value, and [method is_success] will return [code]true[/code]. This class has
## multiple specializations, each implementing a [code]value()[/code] method
## that returns a type-safe success result.
## [br][br]
## If the call failed, [method is_success] will return [code]false[/code]. The
## actual error is returned by [method error].

## Represents an error encountered while ingesting or parsing trimsock data
class ErrorData:
	## The error code
	## [br][br]
	## This indicates the error type. Can be checked programmatically to
	## intelligently try and recover from an error.
	var code: Error

	## The error message
	## [br][br]
	## This gives a further description of the error itself. Should not be
	## relied on, error messages may change between releases without notice.
	## However, they can be useful to convey the issue to the user.
	var message: String

	func _init(p_code: Error, p_message: String):
		code = p_code
		message = p_message

	func _to_string() -> String:
		return "%s: %s" % [error_string(code), message]


## Stores a [TrimsockCommand] on success
##
## See [TrimsockResult] for details.
class Command extends TrimsockResult:
	## Construct a successful result object with the given [param value]
	static func of_value(value: TrimsockCommand) -> Command:
		var result := Command.new()
		result._is_success = true
		result._value = value
		return result

	## Construct a successful result object without any command
	## [br][br]
	## Used when no command could be extracted yet, without any error.
	static func of_success() -> Command:
		var result := Command.new()
		result._is_success = true
		return result

	## Construct an error result
	static func of_error(error: Error, message: String) -> Command:
		var result := Command.new()
		result._is_success = false
		result._error = ErrorData.new(error, message)
		return result

	## Get the resulting command
	## [br][br]
	## Returns [code]null[/code] if the operation failed, or if it succeeded
	## without extracting a command.
	func value() -> TrimsockCommand:
		if _is_success:
			return _value as TrimsockCommand
		else:
			return null

## Stores binary data on success
##
## See [TrimsockResult] for details.
class Data extends TrimsockResult:
	## Construct a successful result object with the given [param value]
	static func of_value(value: PackedByteArray) -> Data:
		var result := Data.new()
		result._is_success = true
		result._value = value
		return result

	## Construct an error result
	static func of_error(error: Error, message: String) -> Data:
		var result := Data.new()
		result._is_success = false
		result._error = ErrorData.new(error, message)
		return result

	## Get the resulting data
	## [br][br]
	## Returns an empty array if the operation failed.
	func value() -> PackedByteArray:
		if _is_success:
			return _value as PackedByteArray
		else:
			return PackedByteArray()

var _is_success: bool
var _value: Variant
var _error: ErrorData

## Construct an error result
static func failure(error: Error, message: String) -> TrimsockResult:
	var result := TrimsockResult.new()
	result._is_success = false
	result._error = ErrorData.new(error, message)
	return result

## Construct a successful result without any value
static func success() -> TrimsockResult:
	var result := TrimsockResult.new()
	result._is_success = true
	return result


## Return true if the operation was successful
func is_success() -> bool:
	return _is_success

## Return the error, or [code]null[/code] if the operation was successful
func error() -> ErrorData:
	if _is_success:
		return null
	else:
		return _error

func _to_string() -> String:
	if _is_success:
		return str(_value)
	else:
		return str(_error)
