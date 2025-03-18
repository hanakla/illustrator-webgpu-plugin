export type AIArt = {
  __type: "AIArtHandle";
  artTypeCode: number;
} & (
  | {
      artTypeName: "Group";
    }
  | {
      artTypeName: "Path";
      style: {
        __type: "AIPathStyle";
      }
    }
  | {
      artTypeName: "CompoundPath";
    }
  | {
      artTypeName: string;
    }
);


export type AIPathStyle = {
  __type: "AIPathStyle";
  fill:
}

export type AIColor = {
  __type: "AIColor";
} & ({
  type:"rgb";
  color: {
    red: number;
    green: number;
    blue: number;
  }
} | {
  type: "cmyk";
  color: {
    cyan: number;
    magenta: number;
    yellow: number;
    black: number;
  }
} | {
  type: "gray";
  color: {
    gray: number;
  }
} | {
  type: "pattern";
} | {
  type: "gradient";
})
