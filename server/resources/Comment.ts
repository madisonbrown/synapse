/* eslint-disable lines-between-class-members */

export {};

const { Resource, Reply } = require("../synapse/synapse");
const { Id, Text, Integer } = require("../synapse/fields");

const { field, endpoint, validator, affect } = Resource.Decorators;

const ledger = [];

class Comment extends Resource {
  @field(new Id()) id;
  @field(new Text()) text;

  @endpoint("GET /last")
  static Last() {
    return ledger[ledger.length - 1] || Reply.NOT_FOUND();
  }

  @endpoint("GET /:id")
  @validator(Comment.schema.select("id"))
  static Find({ id }) {
    return ledger[id] || Reply.NOT_FOUND();
  }

  @endpoint("GET /page/:index")
  @validator({ index: new Integer() })
  static List({ index }) {
    const size = 10;
    const start = ledger.length - size * index;
    const result = ledger.slice(start, start + size).reverse();
    return result;
  }

  @endpoint("POST /")
  @affect("/last") // "/page/*"
  @validator(Comment.schema.select("text"))
  static async Post({ text }) {
    const comment = await Comment.create({ id: `${ledger.length}`, text });
    ledger.push(comment);
    return comment;
  }
}

module.exports = Comment;
