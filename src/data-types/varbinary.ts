import { DataType } from '../data-type';
import WritableTrackingBuffer from '../tracking-buffer/writable-tracking-buffer';

const NULL = (1 << 16) - 1;
const MAX = (1 << 16) - 1;

const VarBinary: { maximumLength: number } & DataType = {
  id: 0xA5,
  type: 'BIGVARBIN',
  name: 'VarBinary',
  maximumLength: 8000,

  declaration: function(parameter) {
    const value = parameter.value as any; // Temporary solution. Remove 'any' later.
    let length;
    if (parameter.length) {
      length = parameter.length;
    } else if (value != null) {
      length = value.length || 1;
    } else if (value === null && !parameter.output) {
      length = 1;
    } else {
      length = this.maximumLength;
    }

    if (length <= this.maximumLength) {
      return 'varbinary(' + length + ')';
    } else {
      return 'varbinary(max)';
    }
  },

  resolveLength: function(parameter) {
    const value = parameter.value as any; // Temporary solution. Remove 'any' later.
    if (parameter.length != null) {
      return parameter.length;
    } else if (value != null) {
      return value.length;
    } else {
      return this.maximumLength;
    }
  },

  writeTypeInfo: function(buffer, parameter) {
    buffer.writeUInt8(this.id);
    if (parameter.length! <= this.maximumLength) {
      buffer.writeUInt16LE(this.maximumLength);
    } else {
      buffer.writeUInt16LE(MAX);
    }
  },

  writeParameterData: function(buff, parameter, options, cb) {
    buff.writeBuffer(Buffer.concat(Array.from(this.generate(parameter, options))));
    cb();
  },

  generate: function* (parameter, options) {
    let value = parameter.value;

    if (value != null) {
      if (parameter.length! <= this.maximumLength) {
        const buffer = new WritableTrackingBuffer(0);
        buffer.writeUsVarbyte(value);
        yield buffer.data;

      } else { //writePLPBody
        const UNKNOWN_PLP_LEN = Buffer.from([0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

        let length;
        if (value instanceof Buffer) {
          length = value.length;
        } else {
          value = value.toString();
          length = Buffer.byteLength(value, 'ucs2');
        }

        let buffer = Buffer.alloc(4);
        if(length > 0) {
          buffer.writeUInt32LE(length, 0);
          
          if(value instanceof Buffer) {
            buffer = Buffer.concat([buffer, value], buffer.length + value.length);

          } else {
            const buffer2 = Buffer.from(value, 'ucs2');
            buffer = Buffer.concat([buffer, buffer2], buffer.length + buffer2.length);
          }
        }

        const end = Buffer.from([0x00, 0x00, 0x00, 0x00]);
        yield Buffer.concat([UNKNOWN_PLP_LEN, buffer, end], UNKNOWN_PLP_LEN.length + buffer.length + end.length); 
      }

      // yield buffer.data;
    } else if (parameter.length! <= this.maximumLength) {
      const buffer = new WritableTrackingBuffer(2);
      buffer.writeUInt16LE(NULL);
      yield buffer.data;
    } else {
      const buffer = new WritableTrackingBuffer(8);
      buffer.writeUInt32LE(0xFFFFFFFF);
      buffer.writeUInt32LE(0xFFFFFFFF);
      yield buffer.data;
    }
  },

  validate: function(value): Buffer | null | TypeError {
    if (value == null) {
      return null;
    }
    if (!Buffer.isBuffer(value)) {
      return new TypeError('Invalid buffer.');
    }
    return value;
  }
};

export default VarBinary;
module.exports = VarBinary;