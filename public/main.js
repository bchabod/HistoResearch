window.addEventListener("load", function(){

  var slider = document.getElementById("slider_confidence");
  if(slider) {
    slider.addEventListener("mousemove", function() {
      document.getElementById("confidence").innerHTML = this.value/10;
    });

    var slider2 = document.getElementById("slider_support");
    slider2.addEventListener("mousemove", function() {
      document.getElementById("support").innerHTML = this.value;
    });
  }
  
});